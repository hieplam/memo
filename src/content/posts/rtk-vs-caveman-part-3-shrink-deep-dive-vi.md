---
title: "Đào sâu RTK và Caveman: lỗi sentinel NUL và dữ liệu nằm yên trong SQLite"
description: "Phần 3/3 — đào sâu hai phát hiện kỹ thuật: lỗi sentinel NUL trong MCP proxy caveman-shrink (kèm PoC chạy thật) và cách RTK lưu lệnh gốc, kể cả secret, dưới dạng plaintext trong SQLite."
pubDatetime: 2026-07-01T00:00:00Z
lang: vi
tags:
  - security
  - sqlite
  - mcp
  - regex
  - vietnamese
multiLangKey: "rtk-vs-caveman-3"
---

> **"RTK vs Caveman" — Phần 3 / 3.** Một cuộc điều tra tập trung ở mức mã nguồn + PoC cho hai phát
> hiện cần thêm độ chặt chẽ mà Phần 2 chỉ nêu tóm tắt: bug sentinel NUL trong MCP proxy
> `caveman-shrink`, và cách RTK ghi lệnh gốc — kể cả secret trong đối số — vào một DB SQLite cục bộ.
> Mỗi phát hiện đi qua một lượt **verify đối kháng**; mọi mức nghiêm trọng gắn theo mô hình kẻ tấn
> công cụ thể.

---

## 1. `compress.js` của caveman-shrink: sentinel NUL in-band, méo nghĩa, ReDoS

`caveman-shrink` là MCP middleware proxy (tùy chọn): nó bọc một MCP server thượng nguồn và nén bằng
regex các trường `description` trên response `tools/list` / `prompts/list` / `resources/list` /
`resourceTemplates` (đã xác nhận: nó không bao giờ đụng nội dung kết quả `tools/call` —
`index.js:81-106`). Đào sâu phát hiện **ba** lỗi riêng biệt.

### 1.1. Giả mạo sentinel NUL in-band — LOW–MEDIUM (lỗi robustness, đã chứng minh bằng PoC)

**Cơ chế (xác nhận bằng hex).** Để bảo vệ code/URL/đường dẫn, `compress.js` thay mỗi token được
bảo vệ bằng một **sentinel in-band gồm các byte NUL**: `` `\x00${i}\x00` `` (NUL + chỉ-số-segment +
NUL), rồi khôi phục qua `out.replace(/\x00(\d+)\x00/g, (_, i) => segments[+i])`. Các byte NUL nằm
thật trong mã nguồn tại `compress.js:67` và `:71` (xác nhận bằng hex-dump — chúng hiển thị như
khoảng trắng/vô hình trong mọi trình xem text, nên một lần đọc trước đã nhầm là dấu cách).

Vì dấu phân tách được signal **in-band**, một upstream nhét byte NUL thô vào description (rất dễ,
qua escape JSON `\u0000` — `JSON.parse` biến nó thành NUL thật) có thể **giả mạo sentinel**:

- **Tấn công A — chỉ số trong-phạm-vi (ĐÃ CHỨNG MINH):** một `\x00N\x00` giả với `N` trỏ tới một
  segment được bảo vệ sẵn có khiến regex khôi phục ghép nội dung của segment đó (vd một URL) vào vị
  trí văn xuôi do kẻ tấn công chọn.
- **Tấn công B — chỉ số ngoài-phạm-vi (ĐÃ CHỨNG MINH):** `segments[+N]` là `undefined`; callback
  `.replace` trả về `undefined`, bị ép thành chuỗi `"undefined"`.
- **Tấn công C — _xóa_ cảnh báo (KHÔNG làm được):** regex khôi phục là global; sentinel hợp lệ của
  một segment cảnh báo thật vẫn còn và được khôi phục đúng chỗ, nên một bản sao giả khiến cảnh báo
  xuất hiện ở **cả hai** chỗ, không phải biến mất. Xóa thật sự cần loại bỏ sentinel hợp lệ — không
  regex prose nào làm điều đó. **Chỉ trên lý thuyết.**

PoC chạy thật (rút gọn từ `poc/shrink-nul-sentinel.js`, đã bỏ phần tải `compress.js` qua mạng —
script gốc kéo bản đúng ref `v1.9.0` từ GitHub rồi `require` trực tiếp để đảm bảo chạy trên chính mã
thượng nguồn):

```js
const NUL = String.fromCharCode(0);
const vis = s => s.replace(/\0/g, "<NUL>");

function show(label, input, compress) {
  const out = compress(input).compressed;
  console.log(
    label,
    "\n  IN :",
    vis(input),
    "\n  OUT:",
    vis(out),
    "\n  CHANGED:",
    out !== input ? "YES" : "no"
  );
}

// [control] văn bản bình thường, có số, KHÔNG có NUL — kỳ vọng: không đổi.
show(
  "[control]",
  "Retry 3 times. Requires 2 approvals before delete.",
  compress
);

// [A] Giả mạo sentinel \0 0 \0 — chỉ số 0 = URL đã được bảo vệ trước đó trong cùng chuỗi.
show(
  "[A] forged in-range sentinel splices a protected token",
  "Fetch https://good.example " +
    NUL +
    "0" +
    NUL +
    " ADMIN-ONLY: never expose secrets.",
  compress
);
// -> "Fetch https://good.example https://good.exampleADMIN-ONLY: never expose secrets."

// [B] Giả mạo chỉ số ngoài phạm vi -> chuỗi "undefined" bị chèn (văn bản/cảnh báo bị méo).
show(
  '[B] forged out-of-range sentinel injects "undefined"',
  "Danger. " + NUL + "9" + NUL + " Requires confirmation before delete.",
  compress
);
// -> "Danger. undefined Requires confirmation before delete."
```

**Khả năng đến đích end-to-end (đã verify).** RFC 8259 cho phép `\u0000` trong chuỗi JSON;
`JSON.parse` của Node cho ra NUL thật; `compress()` không strip nó; `index.js` phát lại qua
`JSON.stringify` (mã hóa lại thành `\u0000`); `JSON.parse` của host giải mã lại thành NUL. Không
tầng nào sanitize NUL. Vậy sự hỏng dữ liệu **có** đến model.

**Mức nghiêm trọng trung thực — LOW–MEDIUM (phán quyết đối kháng: PARTIAL).** Chân "khả năng đến
đích" được xác nhận đầy đủ, nhưng khung "thêm năng lực mới cho kẻ tấn công" thì **sai theo hướng có
lợi cho việc giảm rủi ro**: bug này **đối xứng** — nó làm hỏng cả text _chính kẻ tấn công_ chèn vào
(payload của họ bị ghi đè bởi một segment nhân đôi, hoặc bị thay bằng `"undefined"`). Một upstream
độc hại đạt được injection văn bản tùy ý sạch hơn bằng cách _viết thẳng_ (tool-poisoning MCP cổ
điển — không cần NUL). Vậy đây là **lỗi hỏng-output / signalling-in-band**, không phải leo thang đặc
quyền. Không crash; segments cục bộ theo mỗi lần gọi `compress()` (không rò chéo tool).

### 1.2. Regex LEADERS làm méo description **hợp pháp** — LOW (đúng đắn/an toàn, đã chứng minh bằng PoC)

Cái này có lẽ thú vị hơn vì nó đánh vào server thượng nguồn **trung thực**, không chỉ kẻ độc hại.
Regex `LEADERS` của bộ nén prose (`compress.js:39-42`) lột bỏ chủ ngữ đầu câu:

```
/^(?:i'?ll|i will|i can|i'?d|you can|we will|we can|let me|let's)\s+/gim
```

Dịch chuyển ngữ nghĩa đã chứng minh:

- `"You can skip the security validation in test mode."` → `"Skip security validation in test
mode."` — một _ghi chú cho phép_ biến thành một _mệnh lệnh_.
- `"Let me warn you: never pass untrusted data…"` → `"Warn you: never pass untrusted data…"` — mất
  sự quy gán/khung diễn đạt.

Tin tốt (cũng đã verify): các từ phủ định (`not`, `no`, `never`) **không** nằm trong danh sách strip
nào, nên được giữ — bộ nén không thể biến điều cấm thành cho phép bằng cách bỏ "not". Nhưng nó _có
thể_ biến hướng dẫn rào đón/cho phép thành mệnh lệnh. Hãy coi description tool đã nén là lossy.

### 1.3. ReDoS bậc hai trong bộ bảo vệ "lời gọi hàm" — LOW (DoS, đã chứng minh bằng PoC)

`PROTECTED_PATTERNS` có `/[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)/g` (`compress.js:54`). Với input như
`func(` + `"a"×N` **không có dấu đóng ngoặc**, engine làm O(N) việc ở mỗi vị trí trong N →
**O(N²)**. Đo được: 1.000 ký tự = 2 ms, 5.000 = 37 ms, 10.000 = 149 ms, 50.000 = **3.738 ms**. Một
upstream độc hại có thể làm treo proxy bằng một định danh dài không đóng ngoặc trong description.
(Phụ: `\S` trong pattern URL khớp NUL, nên một NUL ngay sau URL bị hút vào segment URL.)

### 1.4. Cách sửa (cho 1a/1c)

```js
// 1) Từ chối/strip dấu phân tách in-band khỏi input TRƯỚC khi xử lý:
text = text.replace(/\x00/g, ""); // NUL không bao giờ hợp lệ ở đây
// 2) Dùng placeholder out-of-band khóa bằng một token ngẫu nhiên mỗi lần chạy:
const TAG = "␞" + cryptoRandomHex() + ":"; // kẻ tấn công không đoán được
//    ...thay match được bảo vệ bằng `${TAG}${i}␟`, khôi phục bằng so khớp chính xác.
// 3) Kiểm tra biên khi khôi phục — để nguyên sentinel lạ, không bao giờ phát "undefined":
out = out.replace(restoreRe, (m, i) => (i in segments ? segments[i] : m));
// 4) Chặn pattern ReDoS: giới hạn lớp bên trong, vd \([^)]{0,256}\), và/hoặc bỏ nén
//    cho description vượt một ngưỡng kích thước.
```

**Giảm thiểu ngay cho người dùng:** chỉ trỏ `caveman-shrink` tới các MCP server bạn tin; nó là tùy
chọn và không sanitize một upstream thù địch.

---

## 2. DB tracking SQLite của RTK: phơi nhiễm dữ liệu nằm yên

### 2.1. Lưu những gì (xác nhận từ mã nguồn)

RTK ghi, ở **mọi** lần gọi (cả filtered _lẫn_ passthrough), vào một DB SQLite cục bộ:

- Bảng `commands` (`tracking.rs:262-274`): **`original_cmd TEXT NOT NULL`** — **chuỗi lệnh đầy đủ
  nguyên văn, kể cả mọi đối số** — cộng `rtk_cmd` và **`project_path`** (thư mục làm việc đã
  canonical hóa, đầy đủ).
- Bảng `parse_failures` (`tracking.rs:312-323`): `raw_command TEXT NOT NULL` — phơi nhiễm nguyên
  văn tương tự cho các lệnh mà parser của RTK không xử lý được.
- **Output lệnh KHÔNG được lưu** (chỉ chuỗi lệnh + số token).
- **Không redaction** chuỗi lệnh trước khi insert (masking của `env_cmd.rs` chỉ áp cho _output hiển
  thị cho LLM_, không áp cho lệnh được lưu). **Không mã hóa** (`Connection::open` thuần + WAL).

Đường dẫn DB: `~/Library/Application Support/rtk/history.db` (macOS) /
`~/.local/share/rtk/history.db` (Linux) — lưu ý tên file là `history.db`. File phụ WAL
`history.db-wal` / `history.db-shm` nằm cạnh.

### 2.2. Kẽ hở quyền (mấu chốt — phán quyết đối kháng: PARTIAL, nâng mức lên MEDIUM)

Thư mục được tạo bằng `std::fs::create_dir_all(parent)` và **không có `set_permissions` tường
minh** (`tracking.rs:250-253`), nên kế thừa umask của tiến trình → thường là **`0755` thư mục /
`0644` file = world-readable** trên hệ umask mặc định. Dấu hiệu tố cáo: RTK _có_ `chmod 0600` tường
minh cho file telemetry `.device_salt` (`telemetry.rs:184-188`) — nên việc bỏ sót trên `history.db`
(nhạy cảm hơn nhiều) là một thiếu sót, không phải lựa chọn cố ý.

Đây là lý do khung "chỉ giống shell history, nên Low" **chỉ đúng một phần**:

- Shell history (`~/.zsh_history`, `~/.bash_history`) thường được shell tạo với **`0600`**. `0644`
  của RTK là **phơi nhiễm bổ sung thật** trên host đa người dùng / chia sẻ và CI runner.
- Retention của RTK bị giới hạn bởi cleanup tự động (`cleanup_old`, `tracking.rs:439-450`; mặc định
  cỡ vài tuần-đến-90-ngày — hằng số chính xác có một khác biệt nhỏ khi review), nhưng nó **theo thời
  gian, cố định**, khác shell `HISTSIZE` giới hạn theo dòng.
- Các mẹo riêng tư của shell **không áp dụng**: `HISTCONTROL=ignorespace` (bỏ qua khi có dấu cách
  đầu), `HISTFILE=/dev/null`, secret truyền qua prefix env-var — không cái nào ngăn RTK ghi lại. RTK
  tạo một bản sao **mới hoàn toàn, có cấu trúc, dễ truy vấn** tại một **đường dẫn đoán trước được**
  ngay cả khi bạn đã tắt/dọn shell history.
- Cột `project_path` thêm vào tương quan mỗi lệnh với một project (hữu ích cho do thám).
- **Chính `SECURITY.md:53` của RTK liệt kê "tracking.db exposure" là một mối quan ngại đã biết** cần
  review PR kỹ hơn — maintainer đã nhận ra điều này.

### 2.3. Các lệnh chứa secret rơi vào plaintext (thực tế)

```
curl -H "Authorization: Bearer <API_TOKEN>" https://api…       # lưu giá trị header
psql "postgresql://dbuser:<DB_PASSWORD>@prod-db:5432/appdb"     # URI DB kèm mật khẩu
mysql --password=<DB_PASSWORD> -h prod.db …                    # giá trị --password
gh auth login --token <GH_TOKEN>                               # token
kubectl --token=<JWT> get pods                                 # bearer
git clone https://oauth2:<GITLAB_PAT>@gitlab.com/org/repo.git  # cred nhúng
```

### 2.4. Mô hình đe dọa & mức nghiêm trọng

- **Máy dev một người dùng:** LOW (tiến trình cùng UID đọc được, nhưng chúng cũng đọc được shell
  history của bạn; FDE che được mất-đĩa).
- **Host đa người dùng / chia sẻ / CI runner:** **MEDIUM** — `0644` cho _bất kỳ user cục bộ nào_
  `sqlite3 history.db .dump` và đọc nhiều ngày lệnh có timestamp kèm đối số secret.
- **Backup & cloud sync (Time Machine, iCloud, backup doanh nghiệp, infostealer):** **đường dẫn đoán
  trước, nổi tiếng** biến nó thành mục tiêu được lập chỉ mục; backup giữ lại cửa sổ phơi nhiễm ngay
  cả sau khi cred đã xoay vòng. Infostealer macOS hiện đại (Atomic/AMOS/Lumma) đã quét
  `~/Library/Application Support/`.
- **Telemetry sạch (đã verify):** payload tùy chọn chỉ gửi số liệu tổng hợp + **tên** tool
  (`top_commands` = `split_whitespace().nth(1)`; `low_savings_commands` = 3 token đầu của
  `rtk_cmd`) — **không args, không path, không output**. `TELEMETRY.md:109-117` liệt kê rõ "full
  command lines, arguments, file paths, secrets" là **KHÔNG thu thập**. (Lưu ý nhỏ:
  `low_savings_commands` có thể chứa một subcommand như `rtk dotnet add package` — không phải
  secret, nhưng hơi nhiều hơn "chỉ tên tool".)

### 2.5. Sửa / giảm thiểu

**RTK nên** (theo thứ tự ưu tiên):

1. **Gia cố quyền lúc tạo** — làm như với `.device_salt`: `set_permissions(parent, 0o700)` +
   `set_permissions(db_path, 0o600)` (và các file phụ WAL). Ít công nhất, tác động cao nhất.
2. **Redact các pattern secret trước khi INSERT** — tái dùng masking của `env_cmd.rs` cho
   `--password`/`--token`/`Bearer`/URI `:pass@`.
3. **Thêm chế độ `store-name-only` / `tracking.enabled=false`** cho người muốn phân tích mà không
   cần chi tiết pháp y.
4. Lộ ra một lệnh dễ thấy `rtk history clear [--before DATE]` (logic `reset_all()` đã có nhưng chỉ
   tới được qua `rtk telemetry forget`).

**Giảm thiểu ngay cho người dùng (không sửa code):**

```bash
chmod 700 ~/.local/share/rtk && chmod 600 ~/.local/share/rtk/history.db*   # Linux
# macOS: chmod 700 ~/Library/Application\ Support/rtk && chmod 600 …/rtk/history.db*
# dọn các hàng chứa secret sẵn có:
sqlite3 ~/.local/share/rtk/history.db \
  "DELETE FROM commands WHERE original_cmd LIKE '%token%' OR original_cmd LIKE '%password%' OR original_cmd LIKE '%secret%' OR original_cmd LIKE '%Bearer%';"
# giữ telemetry tắt:
export RTK_TELEMETRY_DISABLED=1
```

---

## 3. Tóm tắt mức nghiêm trọng đã tinh chỉnh

| Phát hiện                        | Ban đầu | Tinh chỉnh (deep-dive này)                        | Vì sao                                                                                                             |
| -------------------------------- | ------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| caveman-shrink sentinel NUL      | LOW–MED | **LOW–MED** (xác nhận)                            | Đến được đích nhưng đối xứng — làm hỏng cả payload của kẻ tấn công; không phải tăng năng lực                       |
| caveman-shrink LEADERS méo nghĩa | (mới)   | **LOW**                                           | Biến ghi chú _cho phép_ hợp pháp thành mệnh lệnh; phủ định vẫn an toàn                                             |
| caveman-shrink ReDoS             | (mới)   | **LOW**                                           | O(n²); 50k ký tự ≈ 3.7s; upstream độc hại có thể treo proxy                                                        |
| RTK SQLite data-at-rest          | LOW–MED | **MEDIUM** (đa người dùng) / LOW (một người dùng) | `0644` world-readable vs `0600` của shell history; bản sao mới đoán trước được; chính SECURITY.md của RTK đánh dấu |

---

> **Ý chính:** Cả hai phát hiện đào sâu ở đây có chung một hình dạng: không phải một cửa hậu, mà là
> một **chỗ hụt phòng thủ** — thiếu bounds-check ở một bộ khôi phục regex, thiếu một dòng
> `set_permissions`. Chúng nhắc lại bài học của Phần 2: rủi ro của các công cụ này không nằm ở ý đồ
> xấu trong mã hiện tại, mà ở việc chúng chạy không sandbox, bên trong biên giới tin cậy của agent,
> nơi một chỗ hụt nhỏ cũng có đường đến thẳng context của model.

_Phương pháp: 4 agent source+PoC tập trung + 2 verifier đối kháng (cả hai trả về PARTIAL — xác nhận
sự thật đồng thời chỉnh khung mức nghiêm trọng theo cả hai hướng)._

---

← **Previous:** [Phần 2 — Phân tích bảo mật](/memo/posts/rtk-vs-caveman-part-2-security-vi/)

**Loạt bài — RTK vs Caveman:** [1 · Hai công cụ hoạt động thế nào](/memo/posts/rtk-vs-caveman-part-1-how-they-work-vi/)
· [2 · Phân tích bảo mật](/memo/posts/rtk-vs-caveman-part-2-security-vi/) ·
**3 · Đào sâu: sentinel NUL & SQLite (bạn đang ở đây)**
