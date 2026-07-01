---
title: "Livelock Trong EF Core: ChangeTracker 'Dính' State Cũ, Và Cách Sửa Bằng UPDATE Nguyên Tử"
description: "Một worker chạy theo lịch, giành các dòng thanh toán dưới cơ chế optimistic concurrency (kiểm soát tương tranh lạc quan), bắt đầu livelock khi scale từ 2 instance trở lên — không crash, chỉ là không bao giờ chạy xong. Bài viết truy nguyên nhân gốc hai tầng và so sánh patch tối thiểu ChangeTracker.Clear() với việc loại bỏ hẳn race bằng một UPDATE nguyên tử."
pubDatetime: 2026-07-01T00:15:00Z
lang: vi
tags:
  - ef-core
  - dotnet
  - concurrency
  - distributed-systems
  - sql-server
  - vietnamese
multiLangKey: "ef-core-livelock"
---

## Tóm tắt nhanh (TL;DR)

1. **Nguyên nhân gốc có 2 tầng.** Tầng bề mặt: một `SaveChangesAsync()` thất bại (xung đột rowversion) để lại entity ở trạng thái `Modified` trong change tracker (bộ theo dõi thay đổi) của `DbContext` — EF **không** tự reset trạng thái entity khi có exception. Tầng cấu trúc: worker dùng lại **một `DbContext` scoped xuyên suốt một vòng lặp rút hàng đợi vô hạn**, nên một entity bị "độc" sẽ bị flush lại và fail ở **mọi `SaveChanges` sau đó** trong cùng context — kể cả những lệnh gọi không liên quan gì tới row ban đầu. Nếu lỗi đó còn quyết định điều kiện thoát vòng lặp, vòng lặp sẽ **không bao giờ dừng**: đây là livelock chứ không phải crash — đó là lý do restart service lại "fix" được (context mới tinh không mang state độc).
2. **Fix tối thiểu là `_context.ChangeTracker.Clear()` trong (các) catch block xử lý lỗi.** Kết hợp với `AsNoTracking()` ở phía đọc, đây là một patch nhỏ, ít rủi ro. Nó xử lý đúng triệu chứng (state cũ còn bị track), nhưng không loại bỏ race gốc.
3. **Ngộ nhận thường gặp khi review:** _"Bạn đã thêm `AsNoTracking()` ở chỗ đọc rồi, vậy `Clear()` có thừa không?"_ — Không. Hai thứ này bảo vệ **hai câu query khác nhau**. `AsNoTracking()` chặn câu **đọc** không tạo ra entity được track. Nhưng entity thực sự gây độc cho context lại là entity mà **hàm ghi/giành-khóa** tự load và sửa bên trong nó — câu đó vẫn phải tracking, vì tracking là điều kiện bắt buộc để phát hiện xung đột concurrency (tương tranh) ngay từ đầu. Bỏ `Clear()` mà chỉ giữ `AsNoTracking()`, livelock quay lại ngay.
4. **Fix triệt để hơn về mặt cấu trúc là loại bỏ hẳn race, bằng cách giành row qua một câu `UPDATE` có điều kiện, nguyên tử** — thay vì `SELECT` (track) → sửa → `SaveChanges`. Không entity nào được load/track cho việc ghi; DB báo thắng/thua qua **số row bị ảnh hưởng**, chứ không phải qua exception. Không có exception ⇒ không có gì để bị "cũ" ⇒ livelock **không thể xảy ra về mặt kiến trúc**, chứ không chỉ được vá lại.
5. **SQL Server không có cú pháp `FOR UPDATE`/`SKIP LOCKED`** (đó là của Postgres). Tương đương là locking hint: `WITH (UPDLOCK, READPAST, ROWLOCK)`. Trên EF Core 7+, tương đương ở tầng ORM cho một câu claim nguyên tử thuần túy là `ExecuteUpdateAsync()` — không tracking, không `SaveChanges`, trả về `int` số row. Trên EF Core 6 trở về trước, phải viết câu `UPDATE` có điều kiện bằng raw SQL.

---

> **Bối cảnh cụ thể:** một worker chạy theo lịch (rút dần một hàng đợi các khoản thanh toán "đến hạn", khóa từng cái trước khi giao cho bước xử lý tiếp theo) bắt đầu bị livelock trên production mỗi khi scale lên từ 2 instance trở lên. Pattern này tổng quát hóa cho bất kỳ worker EF Core nào (a) dùng lại **một `DbContext` sống lâu** xuyên suốt một vòng lặp rút hàng đợi, và (b) giành việc bằng kiểu **đọc rồi update có điều kiện** dưới cơ chế optimistic concurrency (kiểm soát tương tranh lạc quan — cột rowversion/timestamp).

## 1. Bối cảnh

Một worker chạy theo lịch. Mỗi tick mở một DI scope → một `DbContext`, rồi rút dần một hàng đợi trong vòng lặp `do…while` cho tới khi không còn gì để giành:

```
tick → mở MỘT DbContext scope
  do {
    row = Pick()          // tìm 1 item đang chờ, chưa ai giành
    if (row == null) { isLast = true; break }
    lockKey = Claim(row)  // đánh dấu đã giành, để instance khác bỏ qua
    if (lockKey == null) continue   // có instance khác giành trước — thử lại
    Process(row)
  } while (!isLast)
```

`Claim()` dùng **optimistic concurrency (kiểm soát tương tranh lạc quan)**: row có cột `rowversion`/`timestamp`, và việc claim là một `Update()` + `SaveChanges()` EF bình thường — SQL sinh ra có `WHERE Id = @id AND Timestamp = @originalTimestamp`. Nếu 2 instance cùng giành 1 row, ai save sau sẽ nhận **0 row bị ảnh hưởng**, EF báo ra thành `DbUpdateConcurrencyException`.

## 2. Chuỗi lỗi dẫn tới livelock

1. `Claim()` của instance B bên trong chạy một câu **có tracking** (`_context.Rows.Where(...).ToListAsync()`), sửa entity, gọi `SaveChangesAsync()`.
2. Instance A thắng trước; timestamp của row đó tăng lên trong DB.
3. `SaveChanges` của instance B chạy `UPDATE ... WHERE Id=@id AND Timestamp=@cu` → **0 row** → ném `DbUpdateConcurrencyException`.
4. **Catch block trả về `null` mà không clear tracker.** Entity vẫn nằm trong context ở trạng thái `Modified`, mang timestamp _cũ_.
5. Vòng lặp tiếp tục (`Pick()` tìm ra row khác chưa ai giành). `Claim()` chạy lại — nhưng giờ `SaveChangesAsync()` flush lại **cả** row mới **lẫn** entity độc từ bước 4, trong cùng 1 transaction. `UPDATE` của entity độc vẫn fail điều kiện `WHERE` → **toàn bộ transaction rollback**, kéo theo cả claim mới lẽ ra hợp lệ.
6. Vì claim không bao giờ commit, cờ "đã giành" phía DB không bao giờ được set, nên `Pick()` cứ trả lại đúng những row cũ chưa ai giành, mãi mãi. Điều kiện thoát (`Pick()` trả về rỗng) không bao giờ đạt ⇒ vòng lặp, và `DbContext` đang giữ nó, không bao giờ kết thúc.

Bước chí mạng là **5→6**: một lần claim thất bại không chỉ fail 1 lần — nó âm thầm phá hoại **mọi claim sau đó** trong cùng context, từ đó đảm bảo vòng lặp không bao giờ rút cạn được.

## 3. Fix 1 (tối thiểu): clear tracker

Thêm `_context.ChangeTracker.Clear()` vào mọi catch block có thể để lại một `SaveChanges` bị rollback, và đánh dấu câu pick phía đọc là `AsNoTracking()` để phòng thủ thêm (code ví dụ ở trên, giữ nguyên bằng tiếng Anh vì đây là code):

```csharp
public Task<Row?> Pick(...) =>
    _context.Rows.AsNoTracking()          // read-only; nothing here should ever be tracked
        .Where(r => r.Status == "Queued" && (r.LockKey == null || r.LockExpiry < DateTime.UtcNow))
        .FirstOrDefaultAsync();

public async Task<string?> Claim(int id, int ttlMinutes)
{
    var row = await _context.Rows.FirstOrDefaultAsync(r => r.Id == id);   // tracking — required to detect conflict
    var key = Guid.NewGuid().ToString();
    row.LockKey = key;
    row.LockExpiry = DateTime.UtcNow.AddMinutes(ttlMinutes);
    try
    {
        await _context.SaveChangesAsync();
        return key;
    }
    catch (DbUpdateConcurrencyException)
    {
        _context.ChangeTracker.Clear();   // <-- the actual fix: evict the stale entity
        return null;
    }
}
```

**Vì sao hai thứ này không thừa nhau** — đây chính là điểm hay gây nhầm khi review code. Truy theo xem câu query nào sinh ra entity bị track:

| Thay đổi                | Query nào                 | Bảo vệ gì                                  |
| ----------------------- | ------------------------- | ------------------------------------------ |
| `AsNoTracking()`        | câu **đọc/pick**          | chặn câu _đọc_ tạo ra entity được track    |
| `ChangeTracker.Clear()` | catch trong **claim/ghi** | xóa entity mà **chính hàm claim** đã track |

Câu load bên trong `Claim()` (`_context.Rows.FirstOrDefaultAsync(...)`) là một query tracking bình thường — **bắt buộc** phải vậy, vì EF chỉ phát hiện được lệch rowversion trên entity nó đang track. Nên entity bị độc luôn luôn xuất phát từ nhánh ghi, không bao giờ từ nhánh đọc. Bỏ `Clear()` mà chỉ giữ `AsNoTracking()` ở pick, livelock **quay lại y nguyên** — vì pick chưa bao giờ là nguồn rò rỉ.

Fix này đúng và ít rủi ro, nhưng mang tính bị động: nó phụ thuộc vào việc mọi catch block đều nhớ gọi `Clear()`. Một nhánh catch mới thêm sau này mà quên gọi sẽ tái tạo lại bug.

## 4. Fix 2 (cấu trúc): UPDATE có điều kiện, nguyên tử

Vấn đề sâu hơn là kiểu **đọc-rồi-ghi-có-điều-kiện** đang race qua 2 lượt round-trip mạng. Gộp nó thành **một câu lệnh nguyên tử duy nhất**: kiểm tra điều kiện "còn trống" và ghi claim trong cùng một `UPDATE`. Database tự đảm bảo tính nguyên tử; không còn khoảng hở nào để instance khác chen vào giữa:

```sql
UPDATE TOP(1) Rows
SET    LockKey = @key, LockExpiry = @ttl
OUTPUT inserted.Id, inserted.RelatedId
WHERE  Status = 'Queued'
   AND (LockKey IS NULL OR LockExpiry < SYSUTCDATETIME())
```

Đọc kết quả: `rows affected == 1` → bạn giành được, dùng row trả về từ `OUTPUT`. `rows affected == 0` → có instance khác giành trước rồi (hoặc không còn gì) — không có exception, chỉ cần thử lại. **Không entity nào được load, không rowversion nào được so sánh, không gì bị track cho việc ghi** — nên không có gì có thể "sống sót" sau một lần thử thất bại để đầu độc các lệnh gọi sau. Cả lớp bug livelock bị loại bỏ, không phải chỉ giảm nhẹ.

Đây là diff lớn hơn Fix 1 (đụng vào hình dạng câu SQL/repository, không chỉ 1 catch block), nhưng nó là pattern kinh điển cho việc **giành việc dưới nhiều consumer đồng thời** — cùng ý tưởng mà các pattern hàng đợi SQL và message broker dùng bên trong.

## 5. Cú pháp khóa row: SQL Server so với Postgres

Rất dễ nghĩ ngay tới `SELECT ... FOR UPDATE` (Postgres) — nhưng đó là một cơ chế khác với atomic claim ở trên, và SQL Server viết theo cách khác:

| Postgres      | SQL Server                | Ý nghĩa                                                     |
| ------------- | ------------------------- | ----------------------------------------------------------- |
| `FOR UPDATE`  | `WITH (UPDLOCK, ROWLOCK)` | khóa row đã chọn để chuẩn bị ghi, chặn các bên giành khác   |
| `SKIP LOCKED` | `WITH (READPAST)`         | không chờ row đang bị khóa — bỏ qua, lấy ứng viên tiếp theo |

```sql
-- SQL Server queue-pick pattern equivalent to `FOR UPDATE SKIP LOCKED`
BEGIN TRAN;
SELECT TOP(1) *
FROM Rows WITH (UPDLOCK, READPAST, ROWLOCK)
WHERE Status = 'Queued' AND (LockKey IS NULL OR LockExpiry < SYSUTCDATETIME())
ORDER BY Id;
-- ... process ...
UPDATE Rows SET ... WHERE Id = @id;
COMMIT;
```

**Nhưng cơ chế này lại không hợp với kịch bản worker thanh toán ở đây**, và điều này đáng hiểu rõ chứ không chỉ là map cú pháp. `FOR UPDATE`/`UPDLOCK` chỉ giữ khóa row **trong suốt 1 transaction DB**. Ở worker này, sau khi giành được 1 row, việc xử lý được giao cho bước xử lý bất đồng bộ phía sau (message bus, gọi ra ngoài) có thể kéo dài hơn 1 transaction rất nhiều — đôi khi vài phút, qua nhiều process khác nhau. Không thể giữ 1 transaction DB mở lâu như vậy.

Đó là lý do hệ thống dùng **lease (khoản thuê tạm) ở tầng ứng dụng** thay vì: một cặp cột `LockKey` + `LockExpiry` lưu thẳng trong row. Đây là khóa mềm, tự hết hạn theo TTL nếu instance giành nó bị chết giữa chừng — thiết kế đúng cho công việc kéo dài/phân tán, và **không phải** là bug. Bug nằm ở **cách ghi cái lease đó** (đọc-rồi-ghi bị race). Câu `UPDATE` nguyên tử (Fix 2) giữ nguyên thiết kế lease, chỉ làm cho việc _ghi_ trở nên nguyên tử. Nếu muốn loại luôn cả race ở bước đọc/pick, gộp pick + claim vào một câu duy nhất: `UPDATE TOP(1) ... OUTPUT inserted.* WHERE ...` — pick và claim trong một round-trip, không cần `SELECT` riêng nữa.

## 6. EF Core 7+: `ExecuteUpdateAsync`

EF Core 6 (một bản LTS phổ biến) không có tương đương ở tầng ORM cho atomic claim — Fix 2 phải viết raw SQL. EF Core 7 giới thiệu `ExecuteUpdateAsync`/`ExecuteDeleteAsync` dạng bulk, chính là bản có kiểu (typed), viết bằng LINQ, của đúng ý tưởng trên:

```csharp
// EF 7+ — replaces load + mutate + SaveChanges + catch(DbUpdateConcurrencyException) entirely
var claimed = await _context.Rows
    .Where(r => r.Id == id && (r.LockKey == null || r.LockExpiry < DateTime.UtcNow))
    .ExecuteUpdateAsync(s => s
        .SetProperty(r => r.LockKey, key)
        .SetProperty(r => r.LockExpiry, ttl));

return claimed == 1 ? key : null;
```

Đặc điểm chính:

- Dịch thành đúng 1 câu `UPDATE ... WHERE ...` gửi thẳng xuống database.
- **Không entity nào được load, không đụng change tracker, không gọi `SaveChangesAsync()`.**
- Trả về số row dạng `int` — thắng/thua chỉ là so sánh thường, không bao giờ là exception.
- Vì không gì bị track, nên về mặt cấu trúc không có gì có thể rò rỉ sang lệnh gọi sau trong cùng `DbContext`. `ChangeTracker.Clear()` trở nên không cần thiết, chứ không chỉ "hiện tại chưa cần".

Lưu ý: nó không trả về các cột khác của row vừa update (không có tương đương `OUTPUT`) — nếu cần lấy lại dữ liệu row vừa giành, hoặc `SELECT` lại sau khi claim thành công (giờ đã an toàn vì mình sở hữu row rồi), hoặc dùng raw SQL với `OUTPUT`. Nó cũng bỏ qua mọi entity đang được track cho row đó trong cùng context — đây là chủ ý, vì pattern này cố tình tránh tracking cho nhánh ghi. Không có `TOP(n)` — với ngữ nghĩa hàng đợi "giành 1 trong nhiều", raw SQL với `UPDATE TOP(1) ... OUTPUT` vẫn là công cụ cần dùng.

## 7. So sánh các phương án

| Phương án                                            | Loại bỏ race?                              | Cần `Clear()`?          | Tín hiệu thắng/thua   | Độ lớn diff               |
| ---------------------------------------------------- | ------------------------------------------ | ----------------------- | --------------------- | ------------------------- |
| Hiện tại (SELECT+track, bắt exception)               | ❌                                         | ✅ phải nhớ ở mọi catch | ném exception         | —                         |
| + `ChangeTracker.Clear()` (Fix 1)                    | ❌ (vẫn race)                              | — (chính nó là fix)     | ném exception         | nhỏ                       |
| + `DbContext`/scope mới cho mỗi vòng lặp             | giảm một phần (giới hạn phạm vi ảnh hưởng) | ❌                      | ném exception         | vừa                       |
| `UPDATE` raw SQL nguyên tử (Fix 2, tương thích EF6)  | ✅                                         | ❌                      | số row bị ảnh hưởng   | vừa                       |
| EF7+ `ExecuteUpdateAsync`                            | ✅                                         | ❌                      | số row bị ảnh hưởng   | vừa, có kiểu (typed)      |
| SQL Server `UPDLOCK, READPAST` pick+claim trong 1 tx | ✅                                         | ❌                      | số row / kết quả rỗng | vừa, cần transaction ngắn |

Xếp hạng, từ "vá an toàn" tới "trị dứt cả lớp bug": **chỉ Fix 1 < Fix 1 + giới hạn số vòng lặp (lưới an toàn) < scope mới mỗi vòng lặp < UPDATE nguyên tử (raw SQL hoặc `ExecuteUpdateAsync`)**. Với hotfix production dưới áp lực thời gian, Fix 1 là lựa chọn hợp lý — nó **thực sự** hoạt động. Với một fix bền vững, loại bỏ cả lớp bug để không tái xuất hiện qua đường code mới, atomic claim mới là đích đúng.

## 8. Đúc kết một dòng

> Một exception ném ra giữa `SaveChanges` không rollback _change tracker_ — chỉ rollback transaction DB. Nếu dùng lại 1 `DbContext` xuyên vòng lặp, state cũ còn bị track đó là quả bom hẹn giờ cho mọi `SaveChanges` sau đó trong cùng scope.

> "Đã thêm `AsNoTracking()` ở chỗ đọc" không làm cho `ChangeTracker.Clear()` ở catch của nhánh ghi trở nên thừa — hãy truy xem entity bị độc thực sự đến từ query nào.

> Khi 2 consumer cùng giành 1 row, nên ưu tiên "để DB tự báo thắng/thua qua một `UPDATE` có điều kiện, nguyên tử" hơn là "phát hiện thua qua việc bắt exception sau một câu đọc có tracking." Cách đầu về mặt cấu trúc không thể để lại tàn dư; cách sau thì luôn có thể.
