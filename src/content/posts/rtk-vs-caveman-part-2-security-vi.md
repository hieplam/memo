---
title: "RTK và Caveman dưới góc nhìn bảo mật: khi công cụ giảm token cũng là một interceptor"
description: "Phần 2/3 — phân tích bảo mật chuyên sâu: vì sao mọi hook/skill chạy trong vòng lặp agent đều là một interceptor nguy hiểm về mặt cấu trúc, và mức độ rủi ro cụ thể của RTK và Caveman theo từng lớp rủi ro."
pubDatetime: 2026-07-01T00:00:00Z
lang: vi
tags:
  - security
  - ai-agents
  - mcp
  - supply-chain
  - llm
  - vietnamese
multiLangKey: "rtk-vs-caveman-2"
---

> **"RTK vs Caveman" — Phần 2 / 3.** Phân tích bảo mật chuyên sâu về bản chất **interceptor** của cả
> hai công cụ — tách rủi ro kiến trúc cố hữu (chung cho cả hai, nghiêm trọng nếu bị lợi dụng) khỏi
> các phát hiện riêng từng tool (đa số low–medium). Mức nghiêm trọng gắn theo mô hình kẻ tấn công cụ
> thể, phản ánh thời điểm đọc mã nguồn công khai của **rtk-ai/rtk @ master** (Rust) và
> **JuliusBrussee/caveman @ main / v1.9.0** (Node + Python) — phiên bản sau có thể thay đổi mọi
> đánh giá.

- Cả hai tool, **theo mã hiện tại**, **không** có backdoor RCE hay rò rỉ dữ liệu lộ liễu, và đều thể
  hiện code phòng thủ tốt hơn mức trung bình.
- Rủi ro thật, cao và **mang tính cấu trúc, giống nhau cho cả hai**: một hook/skill chạy với toàn
  quyền user của bạn, không sandbox, và mọi thứ nó phát ra được tiêm thẳng vào context của model mà
  không sanitize.
- Thứ cần quản lý là **tính toàn vẹn của chuỗi cung ứng (supply-chain)**, không phải code hôm nay.
  Trong hai cái, **Caveman có rủi ro supply-chain cao hơn**.

---

## 1. Kết luận chính

Cả hai tool, **theo mã hiện tại**, **không** có backdoor RCE hay rò rỉ dữ liệu lộ liễu — và cả hai
đều thể hiện code phòng thủ tốt trên mức trung bình (RTK: lexer lệnh hiểu dấu nháy + checksum
fail-closed; Caveman: file cờ chống symlink bằng `O_NOFOLLOW` + hook pin tag và verify SHA-256).

**Rủi ro thật, cao, mang tính cấu trúc và giống nhau cho cả hai:** một hook/skill chạy với **toàn
quyền user của bạn**, không sandbox, và mọi thứ nó phát ra được tiêm thẳng vào context của model mà
không sanitize. Vì vậy một **phiên bản tương lai bị compromise** (bản cập nhật độc hại, token
maintainer bị đánh cắp, MITM khi cài) = chiếm toàn bộ agent: đọc mọi secret agent đọc được và
rewrite/inject mọi lệnh. **Thứ bạn phải quản lý là tính toàn vẹn của chuỗi cung ứng (supply-chain),
không phải code hôm nay.** Trong hai cái, Caveman rủi ro supply-chain cao hơn.

## 2. Vì sao interceptor vốn nguy hiểm

Một Claude Code hook không phải plugin được sandbox — nó là một tiến trình OS chạy với tư cách bạn,
nối vào các sự kiện nuôi model. Theo chính tài liệu Anthropic (đã verify đối kháng):

- _"Với hook UserPromptSubmit … và SessionStart, bất cứ thứ gì bạn ghi ra stdout đều được thêm vào
  context của Claude."_
- `PreToolUse` có thể rewrite input của tool qua `updatedInput`.
- _"Bất kỳ tiến trình nào chạy với tư cách user hiện tại đều ghi được vào `~/.claude/settings.json`.
  Không có bảo vệ ở mức OS, không kiểm chữ ký, không hỏi xác nhận… không có chỉ báo nào cho thấy hook
  đã được đăng ký."_ (claude-code#49778)
- Tiền lệ thật: gói npm **Cozempic** ghi một hook `SessionStart` toàn cục + một `PostToolUse
matcher:""` (thấy mọi tool call) ngay khi cài.

Đó chính là cơ chế RTK và Caveman dùng — và cũng là cơ chế một kẻ tấn công sẽ dùng.

## 3. Ma trận mức nghiêm trọng theo lớp rủi ro

| Lớp rủi ro                                                                         | RTK                                 | Caveman                                     |
| ---------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| **0 · Phơi nhiễm trust-boundary cố hữu** (bản bị compromise → chiếm toàn bộ agent) | 🟧 **HIGH** (cấu trúc, chung)       | 🟧 **HIGH** (cấu trúc, chung)               |
| **1 · Context / prompt injection** (stdout hook & additionalContext)               | 🟩 LOW (chỉ text rules-file)        | 🟨 **MEDIUM** (hành vi: có thể bỏ cảnh báo) |
| **2 · An toàn rewrite lệnh**                                                       | 🟩 LOW (quote-aware, fail-closed)   | — N/A (không rewrite lệnh)                  |
| **3 · Chuỗi cung ứng (cài/cập nhật)**                                              | 🟨 MEDIUM (checksum fail-closed ✔)  | 🟧 **HIGH** (bootstrap không pin)           |
| **4 · MCP proxy / tool-poisoning**                                                 | — N/A                               | 🟨 LOW–MED (bug NUL-sentinel, có PoC)       |
| **5 · Lộ/rò rỉ dữ liệu nhạy cảm**                                                  | 🟨 LOW–MED (args lệnh trong SQLite) | 🟨 MEDIUM (compress → gửi file cho LLM)     |
| **6 · Ghi file cục bộ · symlink · TOCTOU**                                         | 🟩 LOW (kiểm toàn vẹn lúc chạy ✔)   | 🟩 LOW (chống bằng O_NOFOLLOW ✔)            |
| **7 · Code-eval trong loader**                                                     | ⬜ INFO (không có)                  | 🟩 LOW (eval chỉ cục bộ)                    |

## 4. RTK — các phát hiện

### 4.1. Injection qua rewrite lệnh — LOW

- **Phòng thủ tốt.** Hook PreToolUse chỉ _trả về một chuỗi đã rewrite + exit code_ — nó không bao
  giờ thực thi lệnh (agent thực thi, dưới quyền của chính nó).
- Lexer hiểu dấu nháy để nguyên (passthrough) heredoc, `$(...)`, backtick, process-substitution;
  metachar trong nháy đơn được bỏ qua đúng. `discover/lexer.rs:279–315`, `registry.rs:243,497`.
- Tiến trình con spawn bằng `Command::new(prog).args()` (argv/exec, **không** `sh -c`); hook shell
  dùng `jq --arg` (không injection).
- **Tồn dư:** `rtk run` có dùng `sh -c` nhưng chỉ trên lệnh agent đã chọn; hook không bao giờ phát
  ra nó. `main.rs:2322–2328`.

### 4.2. Injection qua project filter (`.rtk/filters.toml`) — MEDIUM

- **Kẻ tấn công:** một repo độc hại nhét file `.rtk/filters.toml`.
- **Giảm thiểu (vững):** trust-gated — khóa SHA-256 lúc `rtk trust`, fail-closed nếu chưa tin, đổi
  nội dung là vô hiệu lại. Bypass env `RTK_TRUST_PROJECT_FILTERS=1` chỉ chạy khi đi kèm biến CI mà
  kẻ tấn công không đặt được trên máy bạn. `toml_filter.rs:192–216`, `hooks/trust.rs:103–118`.
- **Kẽ hở:** _sau khi_ một dev chạy `rtk trust`, các luật `match_output`/`on_empty`/`replace` có thể
  viết lại hoặc bịa output mà LLM thấy (giấu lỗi build, chèn "All tests passed."). `toml_filter.rs:
453–476`.
- Rủi ro thật = social-engineering bước `rtk trust`. **Đừng bao giờ `rtk trust` một file filters bạn
  chưa đọc.**

### 4.3. Chuỗi cung ứng (cài / cập nhật) — MEDIUM

- **Cài binary: fail-closed.** `install.sh` tải `checksums.txt`, từ chối cài nếu thiếu/sai
  SHA-256. `install.sh:104–128`.
- Có bypass: `RTK_SKIP_CHECKSUM=1` âm thầm bỏ qua kiểm tra.
- Script hook được kiểm toàn vẹn lúc chạy, fail-closed (`exit 1` khi bị sửa); nhưng nhánh "no
  baseline" cũ + mô hình hook-nhị-phân mới là no-op. `hooks/integrity.rs`.
- **Điểm yếu:** Homebrew `Formula/rtk.rb` vẫn để `PLACEHOLDER_SHA256_*` (dấu hiệu thiếu bảo trì);
  bootstrap `cargo install --git` không pin; checksum lấy từ chính release đó (repo bị compromise
  thì vô hiệu — giới hạn chung của hầu hết tool). `build.rs` lành tính (chỉ đọc file cục bộ).

### 4.4. Lộ dữ liệu — telemetry & dữ liệu nằm yên (data-at-rest) — LOW–MEDIUM

- **Telemetry: tôn trọng riêng tư.** Tắt mặc định, ba lớp chặn (`RTK_TELEMETRY_DISABLED`, đồng ý
  tường minh, cờ enabled); gửi device hash ẩn danh + version/os/arch + số liệu tổng hợp + **tên**
  lệnh — **không args, không output, không nội dung file**; HTTPS mỗi ngày một lần; có liên hệ
  GDPR. `telemetry.rs:29–46,109–115`, `docs/TELEMETRY.md`.
- **Phơi nhiễm thật:** DB SQLite cục bộ lưu **chuỗi lệnh** đã chạy + số token (không lưu output).
  Các _đối số_ chứa secret — `curl -H "Authorization: …"`, URI psql, `AWS_SECRET=…` — sẽ nằm
  **plaintext, không mã hóa**. `core/tracking.rs`. (Xem Phần 3 của loạt bài này để có phân tích đầy
  đủ.)
- Rủi ro truy cập cục bộ (backup, mất laptop, tiến trình rình mò), không phải rò qua mạng.

## 5. Caveman — các phát hiện

### 5.1. Chuỗi cung ứng — bootstrap không pin — HIGH

- **Kẻ tấn công:** maintainer bị compromise / token bị đánh cắp / MITM push lên `main`; mọi lần cài
  mới đều dính.
- `curl|bash` → `exec npx -y "github:JuliusBrussee/caveman"` — **không pin ref/SHA**; chạy bất kỳ
  `bin/install.js` nào đang nằm trên nhánh mặc định (đổi liên tục), với quyền của bạn.
  `install.sh:54`.
- _File_ hook thì CÓ pin về `v1.9.0` + verify SHA-256, fail-closed khi sai (xóa + hủy) — **tốt**.
  `install.js:36,833–840`.
- **Nhưng fail-OPEN khi thiếu manifest** ("downloaded hooks installed unverified" — chỉ cảnh báo),
  và `CAVEMAN_REF=main` chuyển hướng về nhánh không pin qua chính đường đó. `install.js:843`.
- **Tệ hơn:** nhánh `--with-init`/`--all` tải `caveman-init.js` và `spawnSync` nó **không checksum
  gì cả** → RCE khi MITM/ref bị compromise. `install.js:973–976`.

### 5.2. An toàn hành vi — "bỏ phần rào đón/cảnh báo" — MEDIUM

- Skill được tiêm bảo model: "Trả lời cộc lốc… **Chỉ phần thừa chết đi**. Bỏ… rào đón." Sự cộc lốc
  có thể **lược bỏ cảnh báo bảo mật hoặc lưu ý về hành động không thể đảo ngược**.
  `src/rules/caveman-activate.md`.
- Giảm thiểu: **Auto-Clarity** quay về văn bình thường cho "cảnh báo bảo mật, hành động không thể
  đảo ngược, user bối rối." Nhưng đây là **phán đoán của LLM, không phải đảm bảo cứng** — phán đoán
  sót = một cảnh báo bị bỏ.
- Không phải injection cổ điển (không thêm text độc) — nhưng có thể _gỡ bỏ_ text liên quan an toàn.
  Hãy coi output chế độ caveman là cộc lốc, không phải là nguồn đáng tin về rủi ro.

### 5.3. caveman-compress — nội dung file → LLM — MEDIUM

- Nén file memory/context được làm bằng cách **gửi nội dung file cho model** và viết lại file **tại
  chỗ** (backup để ngoài cây thư mục).
- Danh sách chặn "từ chối `.env`/`.ssh`/`.aws`/file mã nguồn" là **enforce bằng prompt** (chỉ dẫn
  trong skill `.md`), **không enforce bằng code** — dựa vào việc model tuân thủ.
  `plugins/opencode/commands/caveman-compress.md:13`.
- Một `CLAUDE.md` hay `config.json` có dán token thì không nằm trong danh sách chặn → sẽ bị đọc, gửi
  đi, viết lại. Do người dùng chủ động, nhưng hãy review file trước khi nén/commit.

### 5.4. MCP proxy caveman-shrink — bug NUL-sentinel — LOW–MEDIUM

- Proxy bảo vệ code/URL/đường dẫn bằng cách thay chúng bằng một **sentinel chỉ-mục phân tách bằng
  NUL** `\0i\0`, rồi khôi phục qua `/\0(\d+)\0/g` — **signalling in-band**.
  `caveman-shrink/compress.js`.
- **Đã xác nhận bằng PoC:** một upstream nhét NUL qua JSON có thể giả mạo sentinel → ghép một token
  có trong description hoặc chèn chuỗi `"undefined"`, làm hỏng description mà model đọc.
- **Đánh giá trung thực:** description bình thường (không NUL) không bị đụng; và một upstream độc
  hại _vốn đã_ có toàn quyền tool-poisoning, nên bug này gần như không thêm năng lực _mới_. Đây là
  lỗi robustness / in-band-delimiter, không phải leo thang đặc quyền. Chỉ đụng `description` trên
  response _list_, không đụng kết quả `tools/call`. (Xem Phần 3 của loạt bài này, kèm PoC đầy đủ.)

### 5.5. Ghi/đọc file cờ — symlink & TOCTOU — LOW

- **Phòng thủ thực sự kỹ** — và mối đe dọa được mô hình hóa ngay trong code ("kẻ tấn công cục bộ có
  thể trỏ file cờ tới `~/.ssh/id_rsa`… các bộ đọc sẽ hút nội dung đó vào context model").
- `safeWriteFlag`: kiểm chủ sở hữu (uid) của thư mục symlink; từ chối nếu file cờ là symlink; file
  tạm với `O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW` mode `0600`; rename nguyên tử. `readFlag`: từ chối
  symlink, giới hạn 64 byte, `O_NOFOLLOW`, whitelist `VALID_MODES`. `hooks/caveman-config.js:132–
241`.
- Cửa sổ TOCTOU tồn dư rất nhỏ và cần kẻ tấn công **cục bộ** (vốn đã có lựa chọn lớn hơn).

### 5.6. Code-eval & spawn lúc cài — LOW

- `new Function(...)` eval một file `caveman-config.cjs` trên đĩa trong plugin opencode — nhưng
  file được ghi lúc cài, không tải lại; khai thác cần quyền ghi cục bộ trước đó. Là "mùi" kiến
  trúc, không phải vector từ xa. `plugins/opencode/plugin.js:65`.
- **Đã kiểm chéo / chỉnh lại:** `spawnSync(…,{shell:true})` trong installer nhìn có vẻ nguy hiểm,
  nhưng `cmd` luôn là tên provider hard-code + escape đúng `shellEscape`/`quoteWinArg` → **không
  inject được**. `install.js:268,405`.
- **Telemetry: không có** — không tìm thấy phone-home ở đâu. **Sạch.**

## 6. Bối cảnh đe dọa bên ngoài (đã verify đối kháng, nguồn gốc)

Các sự kiện đã công bố này chứng minh lớp rủi ro interceptor là có thật và đang bị khai thác — là cơ
sở cho lớp rủi ro 0 và 3. (Một claim bịa _"Shai-Hulud May 2026"_ xuất hiện khi search đã bị **bác bỏ
và loại**.)

- Hook: stdout từ UserPromptSubmit/SessionStart bị tiêm vào context không sanitize; ai ghi được
  `~/.claude/settings.json` thì đăng ký hook âm thầm (tài liệu Anthropic; claude-code#49778; tiền lệ
  Cozempic).
- MCP: Anthropic _không_ audit bảo mật MCP server (caveman-shrink chưa được kiểm); description của
  tool có thể chứa chỉ dẫn ẩn và đổi sau khi được duyệt; PoC làm lộ SSH key qua description bị
  nhiễm độc (tài liệu bảo mật Anthropic; OWASP MCP Top-10 MCP03; Invariant Labs).
- Chuỗi CVE supply-chain thật của Claude Code: một GitHub issue → đọc `/proc/self/environ` → tuồn
  secret (flatt.tech; Check Point CVE-2025-59536).

**Nguồn gốc:** docs.anthropic.com/claude-code/hooks · github.com/anthropics/claude-code/issues/49778
· docs.anthropic.com/claude-code/security · owasp.org/www-project-mcp-top-10 (MCP03) ·
invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks · flatt.tech
(poisoning-claude-code) · research.checkpoint.com (CVE-2025-59536).

## 7. Kết luận & checklist gia cố

**Nếu phải xếp hạng:** **Caveman rủi ro tồn dư cao hơn** (bề mặt lớn hơn: Node + 30+ tích hợp + MCP
proxy + viết lại file trên đĩa; bootstrap không pin; một nhánh cài không checksum; hành vi có thể
che text an toàn). **RTK chặt hơn** (một binary có checksum, xác định, không LLM/mạng trong đường
nóng, cài fail-closed; điểm sắc nhất là vector social-engineering `rtk trust` và đối số lệnh nằm yên
trong SQLite). **Cả hai** chỉ an toàn ngang với bản cập nhật kế tiếp.

**Làm những điều này dù chạy cái nào:**

1. **Pin tất cả.** Cài Caveman từ tag/commit, không `curl|bash` từ `main`; cài RTK qua release có
   checksum (đừng bao giờ `RTK_SKIP_CHECKSUM=1`). Tránh nhánh `--with-init`/`--all` không checksum.
2. **Audit hook khi nằm yên.** Sau khi cài, đọc `~/.claude/settings.json` (và
   `.clinerules`/`.windsurfrules` của project) — không có gì báo cho bạn biết hook tồn tại. Kiểm lại
   sau mỗi lần cập nhật.
3. **Đừng bao giờ `rtk trust` một `.rtk/filters.toml` bạn chưa đọc** — coi filters đã tin như code
   review.
4. **Đừng chạy `caveman-compress` trên file chứa secret**; danh sách chặn chỉ là khuyến nghị. Review
   phần viết lại tại chỗ trước khi commit.
5. **Chỉ đặt `caveman-shrink` trước các MCP server bạn tin** (nó không sanitize một upstream thù
   địch).
6. **Đừng coi câu trả lời chế độ caveman là nguồn đáng tin về rủi ro** — yêu cầu chi tiết đầy đủ
   trước các hành động không thể đảo ngược/nhạy cảm bảo mật.
7. **Pin phiên bản trong môi trường chung/CI** và theo dõi repo upstream xem có đổi chủ sở hữu/
   maintainer không.

---

> **Ý chính:** Rủi ro lớn nhất không nằm trong logic hôm nay của RTK hay Caveman — nó nằm trong việc
> cả hai _phải_ sống bên trong biên giới tin cậy của agent để làm việc của mình. Quản lý điều đó
> bằng cách pin phiên bản và audit hook, không phải bằng cách đọc lại source mỗi tuần. Phần 3 của
> loạt bài này đào sâu vào hai phát hiện kỹ thuật cụ thể ở trên: bug sentinel NUL của caveman-shrink
> (kèm PoC chạy thật) và cách RTK lưu lệnh gốc trong SQLite.

_Phương pháp: audit mã nguồn của cả hai repo (các agent kiểm song song + tự kiểm chứng) đối chiếu
với một lượt nghiên cứu web đã verify đối kháng (6 góc, 31 nguồn, 16/25 claim được xác nhận, 9 bị
bác)._

---

← **Previous:** [Phần 1 — Hai công cụ hoạt động thế nào](/memo/posts/rtk-vs-caveman-part-1-how-they-work-vi/)
· **Next:** [Phần 3 — Đào sâu: sentinel NUL & SQLite](/memo/posts/rtk-vs-caveman-part-3-shrink-deep-dive-vi/) →

**Loạt bài — RTK vs Caveman:** [1 · Hai công cụ hoạt động thế nào](/memo/posts/rtk-vs-caveman-part-1-how-they-work-vi/)
· **2 · Phân tích bảo mật (bạn đang ở đây)** ·
[3 · Đào sâu: sentinel NUL & SQLite](/memo/posts/rtk-vs-caveman-part-3-shrink-deep-dive-vi/)
