---
title: "RTK và Caveman: hai công cụ giảm token cho AI agent hoạt động thế nào?"
description: "Phần 1/3 loạt bài về RTK và Caveman — hai công cụ giảm token cho LLM/agent tấn công vào hai đầu đối lập của vòng lặp agent: RTK lọc output lệnh trước khi vào model, Caveman khiến chính model viết ngắn gọn hơn."
pubDatetime: 2026-07-01T00:00:00Z
lang: vi
tags:
  - ai-agents
  - llm
  - developer-tools
  - token-optimization
  - rust
  - vietnamese
multiLangKey: "rtk-vs-caveman-1"
---

> **"RTK vs Caveman" — Phần 1 / 3.** Hai công cụ giảm token cho LLM/agent hoạt động ra sao, và vì sao
> chúng tấn công vào hai đầu đối lập của vòng lặp agent thay vì cạnh tranh nhau. Dựa trên đọc trực
> tiếp mã nguồn của cả hai repo — **rtk-ai/rtk** (Rust) và **JuliusBrussee/caveman** (Node + Python).

- **RTK** rút gọn cái đi **vào** model — output lệnh shell nhiễu — bằng một binary Rust xác định
  (deterministic), không có LLM nào trong vòng lặp.
- **Caveman** rút gọn cái đi **ra** từ model — văn xuôi dài dòng — bằng cách khiến chính model viết
  ngắn hơn, cộng thêm một bộ nén regex ở đầu vào (schema tool, file context).
- Vì nhắm vào hai đầu khác nhau của vòng lặp, hai công cụ này **bổ sung cho nhau** chứ không phải
  đối thủ cạnh tranh — bạn có thể chạy cả hai cùng lúc.

---

## 1. Ba nơi vòng lặp agent tiêu token

Một vòng lặp LLM dạng agent tiêu token ở ba chỗ: **context nó đọc** (file, schema của tool), **kết
quả tool** đẩy ngược vào, và **câu trả lời nó viết**. RTK sở hữu ống _kết-quả-tool_; Caveman sở hữu
ống _câu-trả-lời_ và đụng nhẹ vào ống _context/schema_.

## 2. RTK (`rtk-ai/rtk`) — "Rust Token Killer"

**Là gì:** một file nhị phân **Rust** biên dịch sẵn (không có LLM, không gọi mạng trong đường
nóng, overhead `<10ms`). Hỗ trợ ~100 lệnh. Đây là một CLI proxy trong suốt.

**Luồng end-to-end:**

1. **Rewrite trong suốt qua hook.** Khi agent của bạn (Claude Code, Cursor, Copilot, Gemini,
   OpenCode… 9+ agent) sắp chạy `cargo test`, một hook `PreToolUse` kích hoạt. Hook là một
   _delegate mỏng_ — nó đọc JSON của tool-call và gọi `rtk rewrite "cargo test"`.
2. **Khớp registry.** `src/discover/registry.rs` chạy một `RegexSet` đã biên dịch trên bảng tĩnh
   `RULES` (70+ pattern) và trả về `rtk cargo test`. Hook trả lại dưới dạng `updatedInput`, nên
   agent âm thầm chạy phiên bản đã bọc. Bạn không thấy gì.
   - _Bảo mật:_ bộ rewrite **để nguyên (không rewrite)** mọi lệnh có `$(...)`, backtick, heredoc,
     hay process-substitution — một lexer hiểu dấu nháy (quote-aware).
3. **Chạy + bắt output.** Binary `rtk` spawn `cargo test` _thật_ như một tiến trình con và bắt
   stdout/stderr (giới hạn 10 MiB, lột ANSI, biết exit-code). Enum `RunMode`: `Filtered` (bắt toàn
   bộ rồi lọc), `Streamed` (lọc từng dòng cho output khổng lồ), `Passthrough`.
4. **Bộ lọc xác định riêng cho từng tool.** Đây là trái tim. Mỗi tool có một **parser Rust riêng**
   (`cargo_cmd.rs`, `pytest_cmd.rs`, `mvn_cmd.rs`, `gradlew_cmd.rs`, `tsc_cmd.rs`, `git/*.rs`,
   `aws_cmd.rs`, `golangci_cmd.rs`…). Nó _hiểu_ định dạng: giữ lại lỗi + ngữ cảnh lỗi + số liệu
   tổng kết, bỏ test pass, thanh tiến trình, banner. Lệnh lạ thì rơi xuống pipeline TOML 8 tầng
   tổng quát (`.rtk/filters.toml`) hoặc để nguyên.
5. **Kết quả gọn vào context.** `cargo test` ≈ 25k token → RTK trả về ≈ 2.5k (`"3 failed, 142
passed"` + 3 lỗi đó).

**Lossy nhưng có cấu trúc:** vứt 90% phần nhàm chán, giữ tín hiệu. **Tiết kiệm:** 60–90% trên
output lệnh, đo theo từng lệnh vào một DB SQLite cục bộ (`~/.local/share/rtk/`) bằng ước lượng
token `chars÷4`, hiển thị qua `rtk gain`.

## 3. Caveman (`JuliusBrussee/caveman`) — "why use many token when few do trick"

**Là gì:** không phải binary — một **skill/plugin đa nền tảng** (Node + Python + hook) cho Claude
Code, Codex, Gemini, Cursor, OpenCode… 30+ agent. Thực ra là **hai cơ chế trong một**:

### 3.1. Chế độ hành vi (phía output — phần thắng lớn)

Nó tiêm một luật vào system context: _"Trả lời cộc lốc như người tiền sử thông minh. Giữ nguyên
mọi nội dung kỹ thuật. Chỉ phần thừa chết đi."_ — đưa vào qua hook `SessionStart` (nạp `SKILL.md`)
và nhắc lại mỗi lượt qua `UserPromptSubmit`. **Chính model** sau đó viết câu trả lời ngắn hơn:

> "Chắc chắn rồi! Tôi rất sẵn lòng giúp. Vấn đề có lẽ ở middleware xác thực…" (69 token) →
> **"Bug ở auth middleware. Kiểm tra hạn token dùng `<` thay vì `<=`. Sửa:"** (19 token)

- Mức độ: `lite` / `full` / `ultra` / `wenyan` (Văn ngôn — Hán cổ, giảm ~80–90%).
- Van an toàn **Auto-Clarity**: quay về văn xuôi bình thường cho cảnh báo bảo mật, hành động không
  thể đảo ngược, hoặc khi bạn bối rối; code & PR luôn viết bình thường.
- Một nhóm sub-agent `cavecrew` (investigator/builder/reviewer) chạy trên Haiku.

### 3.2. Bộ nén xác định (phía input)

Regex thuần Node/Python (`compress.js`), không gọi model:

- **`caveman-shrink`** — một MCP proxy bọc một MCP server thượng nguồn và nén các trường
  `description` trong response `tools/list` (cắt schema tool phình to).
- **`caveman-compress`** — lệnh `/caveman-compress` viết lại các file như `CLAUDE.md` trên đĩa.
- Luật: bỏ mạo từ (a/an/the), từ đệm (just/really/basically), lời khách sáo, rào đón. **Được bảo
  vệ & không bao giờ đụng:** code (fenced/inline), URL, đường dẫn, định danh, số phiên bản.

**Số tiết kiệm — đọc với thái độ hoài nghi:** marketplace nói **~75%**; lệnh `/caveman-stats` thực
tế áp một hằng số _hard-code_ `0.65` (chỉ chế độ "full" được benchmark thật); và eval 10-prompt của
chính Caveman so với baseline "Answer concisely." cho thấy **~50–53% với độ biến thiên rất lớn (−2%
tới +87%)**. Vì phần thắng đến từ việc model _tự chọn_ viết ít hơn, không thể đo nếu không có một
lần chạy đối chứng — khác RTK, vốn thấy chính xác cái nó đã vứt đi.

## 4. So sánh từng điểm

|                        | **RTK**                                | **Caveman**                                                   |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------- |
| Giảm                   | token **INPUT** (output tool/lệnh)     | token **OUTPUT** (văn của model) + một ít input (schema/file) |
| Cơ chế                 | parser Rust xác định, theo từng tool   | ① đổi hành vi LLM (prompt) · ② regex                          |
| Có LLM trong vòng lặp? | **Không**                              | ① **Có** (chính model) · ② Không                              |
| Runtime                | một binary Rust, `<10ms`, offline      | hook Node+Python, MCP proxy                                   |
| Lossy?                 | Lossy nhưng có cấu trúc                | ① tóm tắt lossy · ② gần như lossless                          |
| Phạm vi                | ~100 tool _đã biết_ (còn lại fallback) | mọi văn xuôi, mọi tác vụ (tổng quát)                          |
| Cơ sở đo               | đo raw-vs-filtered thật (`rtk gain`)   | phần lớn là ước lượng/hành vi                                 |
| Hợp nhất cho           | phiên nhiều build/test/git/cloud       | phiên nhiều giải thích; cắt schema MCP/CLAUDE.md phình        |

## 5. Bổ sung cho nhau, không phải đối thủ

RTK cắt cái agent _đọc từ tool_; Caveman cắt cái agent _viết ra_ (và schema/file nó _đọc_). Chạy cả
hai thì cộng dồn, chỗ duy nhất chồng lấn là nén MCP/CLAUDE.md — mà ngay cả ở đó cũng nhắm vào nội
dung khác nhau.

---

> **Ý chính:** RTK và Caveman không cạnh tranh vì chúng không tranh giành cùng một token — một cái
> giữ chặt cửa vào, cái kia giữ chặt cửa ra. Phần 2 của loạt bài này sẽ nhìn cả hai qua lăng kính
> bảo mật: chạy như một hook bên trong vòng lặp agent nghĩa là gì, và rủi ro thật nằm ở đâu.

_Nguồn: đọc mã nguồn của cả hai repo — rtk-ai/rtk (Rust) và JuliusBrussee/caveman (Node + Python).
Số liệu benchmark do nhà phát hành công bố._

---

**Next:** [Phần 2 — Phân tích bảo mật](/memo/posts/rtk-vs-caveman-part-2-security-vi/) →

**Loạt bài — RTK vs Caveman:** **1 · Hai công cụ hoạt động thế nào (bạn đang ở đây)** ·
[2 · Phân tích bảo mật](/memo/posts/rtk-vs-caveman-part-2-security-vi/) ·
[3 · Đào sâu: sentinel NUL & SQLite](/memo/posts/rtk-vs-caveman-part-3-shrink-deep-dive-vi/)
