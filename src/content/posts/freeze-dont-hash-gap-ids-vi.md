---
title: "Đóng băng, đừng băm: cho một agent không tất định một danh tính tất định"
description: "Chuyện tui thiết kế bộ phát hiện lỗ hổng quy tắc cho Tracker — một agent trong hệ thống code review nhiều-agent tên tribe — và bài học rút ra: đừng băm (hash) lời văn của một con LLM để làm danh tính, hãy đóng băng một mẫu câu lệnh mà nó viết ra, rồi đối chiếu bằng cách chạy lại."
pubDatetime: 2026-07-27T09:00:00Z
lang: "vi"
tags:
  - ai-agents
  - non-determinism
  - deduplication
  - code-review
  - claude-code
  - harness-design
  - vietnamese
multiLangKey: "freeze-dont-hash-gap-ids"
---

Hồi tui kể chuyện [con plugin tribe ra đời vì hết tin nổi chữ "done"](/memo/posts/tribe-plugin-va-cau-chuyen-bun-migrate/), tui có nhắc sơ một vai tên **Tracker** — con soi diff theo luật (rule) đã viết ra của repo. Bài này tui kể kỹ hơn một bài toán riêng của Tracker, nhỏ mà xương: làm sao cho mỗi thứ nó phát hiện một cái ID sống được qua nhiều lần chạy, mà bản thân nó thì **không nhớ gì** giữa các lần chạy đó. Sửa sai một lần, tui học được một bài học tổng quát hơn nhiều: đừng bao giờ băm (hash) lời văn của một con LLM để làm danh tính (identity).

---

## Bài toán: một lỗ hổng cần một cái tên sống lâu hơn một PR

Ngoài việc soi luật đã viết, Tracker còn làm thêm một việc: nó đi tìm **lỗ hổng harness** (harness gap) — một pattern code cứ lặp đi lặp lại trong repo mà chưa có luật nào quản. Ví dụ: "9 file độc lập nhau đều nuốt exception (lỗi ngoại lệ) bằng một `catch {}` trống trơn." Đây không phải vi phạm luật (vì làm gì có luật), nó là một **ứng viên** — để một con người quyết định:

- **promote thành rule** — viết nó ra, từ nay bắt buộc tuân theo;
- **promote thành anti-rule** — viết ra rằng pattern này bị cấm luôn, tường minh;
- **ghi nhận là debt** (nợ kỹ thuật) — biết rồi, chưa sửa, nhưng có theo dõi;
- **dismiss** — thôi, không phải vấn đề gì.

Vấn đề nằm ở chỗ này: Tracker chạy lại từ đầu trên **mọi** PR, và mỗi lần chạy là một lời gọi LLM (LLM call) hoàn toàn mới — nó không nhớ gì về lần chạy trước. Không có ID ổn định, cùng một lỗ hổng thật sẽ bị báo lại y chang, mới tinh, trên từng PR, mãi mãi — vì chẳng có gì nói cho hệ thống biết "cái này thấy rồi." Mà một khi người ta đã ra quyết định trên một lỗ hổng (kiểu "cái này chấp nhận là debt đi"), quyết định đó phải dính, không được hỏi lại tuần sau.

## Lần đầu tui làm: băm mô tả — và nó bể âm thầm

Thiết kế đầu tui nghĩ ra nghe rất hợp lý:

```
gap_id = hash(mô_tả_pattern + phạm_vi_đường_dẫn)
```

Cách này chạy ngon nếu cùng một đầu vào (input) luôn cho ra cùng một mô tả. Nhưng "đầu vào" của Tracker không phải một hàm cố định — nó là một lần LLM hoàn tất câu trả lời (completion), và hai lần hoàn tất khác nhau thì ra chữ khác nhau, dù đang tả đúng một chuyện. Tui thấy tận mắt luôn:

| Lần chạy | Mô tả Tracker viết                                       | Câu lệnh bằng chứng nó dùng              |
| -------- | -------------------------------------------------------- | ---------------------------------------- |
| PR #61   | "handler nuốt lỗi bằng catch rỗng"                       | `grep -rn 'catch {}' src/handlers/`      |
| PR #64   | "khối catch rỗng làm mất exception trong module handler" | `grep -rn 'catch\s*{\s*}' src/handlers/` |

Cùng code y chang. Cùng vấn đề y chang. Nhưng hai câu chữ khác nhau, hai regex khác nhau → **hai hash khác nhau**. Cái hàm `hash()` không có cách nào biết hai dòng đó đang tả cùng một thứ, vì bản chất hash là phải nhạy với từng ký tự — mà văn xuôi từ một lời gọi LLM mới tinh chính là loại đầu vào đổi kiểu chẳng mang ý nghĩa gì hết.

Cái chết người ở đây là: lỗi này **âm thầm**. Không crash, không báo đỏ gì cả. Hệ thống cứ lặng lẽ đúc ra `G-014` cho một lỗ hổng mà thật ra là `G-002` đã thấy từ bốn PR trước, và mọi con số tính dựa trên "một lỗ hổng = một ID" giờ sai bét mà chẳng ai biết. Một metric kiểu precision (độ chính xác) — "trong N lỗ hổng báo cáo, bao nhiêu cái là nhận lại đúng, bao nhiêu là đúc trùng" — bị hư từ gốc, không một dòng log nào nhắc mình đi kiểm tra lại.

## Cách tui sửa: mượn đúng cái mẹo C3 đã làm

Chỗ tui bí thì đi soi lại repo coi có ai giải bài toán tương tự chưa — và có: **C3**, công cụ viết tài liệu kiến trúc (architecture-documentation) tui đang dùng ngay trong codebase này. Cách C3 làm: mọi entity (thực thể) nó quản — một component, một rule, một bản ghi quyết định kiến trúc — nhận ID **đúng một lần, lúc mới sinh ra** (kiểu `c3-215`, `rule-no-squash-merge`), và ID đó **đóng băng vĩnh viễn**. C3 không bao giờ suy ra lại (re-derive) ID bằng cách chạy lại cái quy trình đã tạo ra entity đó — ID là con trỏ (pointer) gán lúc sinh, không phải hash của mô tả hiện tại.

Áp dụng đúng luật đó cho lỗ hổng của Tracker, tui làm ba việc:

1. **Đúc ID đúng một lần.** Lần đầu thấy một lỗ hổng, gán ID tuần tự kế tiếp: `G-001`, `G-002`, … Không bao giờ suy ra lại sau đó.
2. **Đóng băng câu lệnh bằng chứng, không đóng băng mô tả.** Đúng cái câu `grep -rn 'catch {}' src/handlers/` mà Tracker tình cờ viết ra ở PR #61 — tui chụp nguyên văn, lưu làm dấu vân tay (fingerprint) vĩnh viễn của lỗ hổng đó, trong một sổ cái chỉ-thêm-không-sửa (append-only ledger, định dạng JSONL — mỗi dòng một object JSON, không bao giờ ghi đè, nên lịch sử là một audit trail dễ diff).
3. **Đối chiếu bằng chạy lại, không bằng so sánh.** Mỗi lần Tracker chạy sau, một lỗ hổng ứng viên mới được đem so với các mục _đang mở_ trong sổ cái — không phải bằng cách so mô tả mới với mô tả cũ, mà bằng cách **chạy lại từng dấu vân tay đã lưu** lên diff hiện tại. Một câu lệnh shell thì hoặc ra kết quả hoặc không — cái đó tất định (deterministic), dù con LLM viết ra câu lệnh lúc đầu có tất định hay không.

Đây là cốt lõi, tui phát biểu một lần cho gọn:

> **Khi một bộ sinh không tất định (một con LLM) sinh ra thứ mang danh tính, đừng băm cái nó nói ra — hãy chụp lại MỘT mẫu của nó thành một phép kiểm tra đóng băng, chạy lại được, rồi trả lời câu "đây có phải cùng một thứ không?" bằng cách chạy lại, không phải so sánh.**

Băm hỏi "hai mô tả này giống nhau không?" — câu mà văn xuôi trả lời rất không đáng tin. Chạy lại hỏi "cái đầu dò đóng băng này còn nổ không?" — câu mà mã thoát (exit code) của shell trả lời y hệt nhau, mỗi lần.

## Ba PR, một sổ cái — chạy tay cho mọi người coi

**PR #61, sổ cái còn trống.** Tracker báo một lỗ hổng ứng viên: 9/9 file trong `src/handlers/` dính `grep -rn 'catch {}' src/handlers/`. Sổ cái trống, không có gì khớp → đúc `G-001`, đóng băng đúng câu grep này làm dấu vân tay:

```json
{
  "id": "G-001",
  "event": "opened",
  "category": "error-handling",
  "paths": ["src/handlers/"],
  "fingerprint": "grep -rn 'catch {}' src/handlers/",
  "hits_at_detection": 9,
  "first_seen_pr": 61
}
```

**PR #64, cùng vấn đề thật, một phiên Tracker hoàn toàn khác.** Lần gọi LLM mới tinh tả cùng pattern bằng chữ khác hẳn ("khối catch rỗng làm mất exception trong module handler") và viết một regex khác để chứng minh. Đối chiếu **không đọc mô tả này chút nào** — nó lấy dấu vân tay đã lưu của `G-001`, chạy lại lên các file trong diff hiện tại. Vẫn nổ (giờ 10 hit, có thêm một file mới dính) → nhận ra là cùng một lỗ hổng. Ghi thêm một dòng, không đúc ID mới:

```json
{ "id": "G-001", "event": "seen", "pr": 64, "hits_now": 10 }
```

**PR #67, một con người ra quyết định.** Người review nhìn qua lỗ hổng này rồi promote nó: từ nay `catch {}` trống trong handler là một anti-rule tường minh. Sổ cái ghi lại quyết định đó, và vì lỗ hổng giờ đã được enforce bằng một rule thật, viết ra hẳn hoi, nó bị ẩn khỏi báo cáo từ đây về sau:

```json
{
  "id": "G-001",
  "event": "ruled",
  "disposition": "anti-rule",
  "ref": "rule-no-bare-catch"
}
```

Ba PR, một danh tính, mỗi sự kiện một dòng sổ cái. Không phải đọc lại lời văn của ai để quyết định "đây có phải cùng một lỗ hổng không."

## Nói thiệt: cách này cũng có lúc sai — nhưng sai kiểu thấy được

Thiết kế này không hoàn hảo, và tui biết chính xác nó sai ở đâu. Nếu code bên dưới đổi đủ nhiều — ví dụ handler được refactor (viết lại cấu trúc) sao cho không còn file nào khớp `catch {}` nguyên văn nữa, dù bản chất vẫn còn đúng con bug đó dưới hình dạng khác — dấu vân tay đã lưu của `G-001` sẽ ngừng nổ. Đối chiếu lúc đó trật, và một ID **mới** bị đúc cho cái mà, thật ra, vẫn là cùng một lỗ hổng gốc — kiểu `G-014`, nằm ngay cạnh `G-001` trong báo cáo kế tiếp.

Đó là một cái giá thiệt — một ID trùng giả (spurious duplicate) — nhưng so hình dạng của nó với lỗi của cách băm cũ: cái này **nhìn thấy được**. Người review thấy hai lỗ hổng giống hệt nhau về cấu trúc xuất hiện chung một lượt, tay đánh dấu cái này là bản sao của cái kia là xong, và một metric precision có thể loại các cặp trùng-đã-biết ra khỏi con số của nó. Còn lỗi của cách băm thì âm thầm — chẳng có gì từng chỉ vô nó cả. Giữa "thỉnh thoảng đếm trùng, nhưng người ta thấy và sửa được" với "âm thầm làm hư một metric mà không triệu chứng nào" — chỉ có cái đầu đáng đem đi ship.

## Bài học mang theo, ngoài chuyện catch block

Chuyện này không riêng gì catch block, Tracker, hay tribe. Nó áp được cho **bất kỳ pipeline nào có một agent LLM sinh ra finding/issue xuyên nhiều lần chạy độc lập, không tất định, mà tầng sau cần biết finding lần N+1 có "giống" finding lần N hay không**: bot phân loại flaky test, agent quét bảo mật, agent "review kiến trúc", pipeline LLM-as-judge (dùng LLM để chấm) theo dõi các kiểu lỗi lặp lại — chỗ nào một lời gọi model mới tinh được giao việc nhận ra thứ đã từng được nhận ra rồi.

Câu tui mang theo: **danh tính của output từ một bộ sinh không tất định không phải là thuộc tính của nội dung output — nó là một quyết định, ra một lần, rồi đóng băng.** Nếu bộ sinh đó phát ra được một đầu dò cơ học, chạy lại được (một câu grep, một test, một query, một lint rule) cho cái nó nhận ra, hãy đóng băng đầu dò đó làm dấu vân tay, rồi đối chiếu bằng cách chạy lại nó. Còn nếu nó không phát ra được thứ đó, mình kẹt lại với việc so văn xuôi — mà so văn xuôi thì luôn luôn chỉ là phán đoán về độ giống nhau, không bao giờ là một phép kiểm tra danh tính thật sự.

## Đọc thêm

- [Campaign Runner: một orchestrator TypeScript đọc bằng con mắt dev C#](/memo/posts/tribe-campaign-runner-orchestrator-vi/) — bộ điều phối của tribe, cái spawn ra các phiên thực thi mà Tracker và mấy vai còn lại chạy bên trong.
- [Bun port 1 triệu dòng code trong 11 ngày — và cái plugin tui viết vì hết tin nổi chữ "done"](/memo/posts/tribe-plugin-va-cau-chuyen-bun-migrate/) — chuyện gốc vì sao tribe (và Tracker) ra đời.
- Thủ pháp danh tính tui mượn ở đây là mô hình entity-ID của C3: danh tính gán đúng một lần lúc tạo entity, không bao giờ suy ra lại bằng cách chạy lại quy trình đã tạo ra nó — cùng một pattern, áp cho docs thay vì cho finding của agent.
