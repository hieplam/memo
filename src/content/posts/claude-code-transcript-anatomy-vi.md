---
title: "Giải phẫu một transcript Claude Code: turn, token và các tác nhân thực sự hoạt động thế nào"
description: "Mổ xẻ từng dòng định dạng .jsonl của phiên Claude Code — cách tái dựng một turn, ý nghĩa thật của số đếm token, và bảy thứ đội lốt prompt của người dùng — đã kiểm chứng trên 1.107 transcript thật."
pubDatetime: 2026-07-01T12:00:00Z
lang: vi
tags:
  - claude-code
  - transcript
  - jsonl
  - llm
  - ai-agents
  - vietnamese
multiLangKey: "transcript-anatomy"
---

Mỗi phiên Claude Code tự ghi xuống đĩa thành một file `.jsonl` — mỗi dòng một object JSON, được nối thêm (append) theo thời gian thực. Nhìn thì có vẻ chỉ cần một buổi chiều là dịch ngược xong: tìm dòng của user, tìm dòng của assistant, đếm token, xong.

Không đơn giản vậy. Một dòng ghi `role:"user"` chưa chắc là con người. Một "turn" (lượt xử lý prompt) không phải là một lần gọi API. Một `input_tokens` bé xíu không có nghĩa là prompt nhỏ. Và cả một subagent (tác nhân con) có thể chạy, tự nén ngữ cảnh của nó, rồi báo cáo lại — mà không một byte nào của nó xuất hiện trong file bạn đang đọc.

Bài này mổ xẻ toàn bộ định dạng: bản khảo sát gốc tìm ra gì, và điều gì trụ vững (hay không) khi nó bị **kiểm chứng đối kháng (adversarial audit)** trên **1.107 transcript thật**, trải các phiên bản CLI 2.1.168 → 2.1.197.

Nhãn bằng chứng dùng xuyên suốt: 🟢 **kiểm-chứng-file** (quan sát trực tiếp trong transcript thật), ✅ **kiểm-chứng-tài-liệu** (tài liệu chính thức của Anthropic), 🟡 **suy luận** (lập luận — Claude Code là mã đóng). Các đính chính do audit tìm ra được gom trong bảng Errata bên dưới.

## Tóm tắt nhanh (TL;DR)

- **Transcript là một CÂY, không phải chuỗi thẳng.** ~15% số dòng trong file thật là bản ghi bookkeeping (sổ sách) *không có* `uuid`, xen kẽ giữa hội thoại thật — và 59,2% số file thực sự có nhánh (fork), chứ không chỉ append.
- **`tool_result` trông y hệt tin nhắn của user** (`type:"user"`, `role:"user"`) dù nó do harness (bộ khung Claude Code) sinh ra — và đó chỉ là **1 trong ít nhất 7** thứ đội lốt `role:"user"` mà không có con người đứng sau.
- **Một turn không phải một lần gọi API.** Một turn thật trải **4 `requestId`** khác nhau dưới cùng một mỏ neo `turn_duration` — và mỏ neo đó chỉ xuất hiện ở ~9% số file phiên.
- **`message.usage` đã phình từ 4 field lên ~10** (`server_tool_use`, `service_tier`, `cache_creation`, `inference_geo`, `iterations`, `speed`), và `input_tokens` nhỏ *không* có nghĩa cửa sổ ngữ cảnh nhỏ.
- **Sáu hệ thống con nguyên vẹn bị bỏ sót ở lần khảo sát đầu**: subagent/sidechain, compaction (nén ngữ cảnh), bộ 8 subtype của `system`, "sở thú" các field định danh, cấu trúc cây, và payload có cấu trúc `toolUseResult`.
- **Kết quả audit**, trên 22 tuyên bố có thể phản nghiệm được đối chiếu toàn corpus: **6 CONFIRMED**, **14 PARTIAL** (đúng tinh thần, sai chi tiết), **2 REFUTED** (sai hẳn).

---

## 1. File transcript thực chất là gì

Mỗi phiên Claude Code ghi vào `~/.claude/projects/<project>/<sessionId>.jsonl`. **JSONL** nghĩa là mỗi dòng một object JSON hoàn chỉnh, append dần khi phiên chạy. ✅

Các field cốt lõi trên một dòng hội thoại:

| Field | Ý nghĩa |
|---|---|
| `type` | Bộ phân loại sự kiện: `user`, `assistant`, `system`, `attachment`, … |
| `uuid` | ID duy nhất của dòng này |
| `parentUuid` | Trỏ ngược về dòng trước — tạo thành **cây** hội thoại (xem §10 về sắc thái overload) |
| `timestamp` | UTC, ISO 8601 |
| `message` | Payload — `role`, `content`, và `usage` trên dòng user/assistant |
| `requestId` | Trên dòng `assistant` — định danh một lần gọi API (vắng mặt trên dòng lỗi tổng hợp, xem §4) |
| `sessionId`, `cwd`, `gitBranch`, `version` | Metadata phiên — nhưng là *ảnh chụp theo từng dòng*, không phải hằng số cố định (§10.6) |

Bên trong `message.content` là các **content block**: `text`, `thinking`, `tool_use`, `tool_result` — và cả **`image`** (§11), thứ mà hầu hết bài viết bỏ qua. ✅🟢

> 🟡 **Một message logic, tách trên nhiều dòng.** Claude Code thường ghi *mỗi content block thành một dòng riêng*: hai dòng `assistant` liên tiếp có thể chia sẻ cùng `requestId` **và** cùng `message.id`, một dòng chứa `thinking`, dòng kia chứa `text`, cách nhau khoảng một mili-giây. Đây là kiểu phổ biến — 74,6% số `message.id` của assistant bị tách trên 2–16 dòng — nhưng **không phải bất biến**. Harness đôi khi gộp nhiều block vào một dòng, kể cả trên bản mới nhất.

> ⚠️ **Không phải dòng vật lý nào cũng nằm trong chuỗi.** Khoảng 15% số dòng trong file thật là bản ghi bookkeeping *không có* `uuid` (`mode`, `last-prompt`, `ai-title`, `file-history-snapshot`, `started`, `result`, `pr-link`, …) xen kẽ khắp file. "Mỗi dòng một JSON, nối qua `uuid → parentUuid`" chỉ đúng **cho bốn kiểu hội thoại** (user/assistant/system/attachment), không phải cả file.

---

## 2. Ba tác nhân, hay bốn — và cái bẫy `tool_result`

| Tác nhân | `type` nó tạo ra | Gọi API? | Vai trò |
|---|---|:---:|---|
| 🧑 **User** | `user` (role=user, text thuần) | ❌ | Gửi prompt mở một turn |
| 🤖 **Model** | `assistant` (có `requestId`) | ✅ | Suy nghĩ, trả lời, yêu cầu tool |
| ⚙️ **Harness** | `attachment`, `system`, **`tool_result`**, cùng cả tá kiểu bookkeeping | ❌ | Bơm ngữ cảnh, chạy tool, đo thời gian turn |
| 🤝 **Teammate** | `user` (chuỗi thuần, `<teammate-message>`) | gián tiếp | Một phiên Claude *khác* báo cáo về (§7) |

### Cái bẫy lớn: `tool_result` trông như user 🟢 CONFIRMED

Một dòng `tool_result` mang `type:"user"`, `role:"user"` — dù harness tạo ra nó, không phải con người. Đã kiểm chứng cạn kiệt: **16.255** dòng `tool_result` trong corpus, 100% có `type/role = user/user`, **không ngoại lệ**. Dấu hiệu nhận biết nguồn-harness: nó còn mang một object `toolUseResult` ở top-level và một backlink `sourceToolAssistantUUID` (§10, §11) mà dòng người-gõ không bao giờ có.

Lọc theo kiểu "tách turn ở `role == user`" sẽ chọn nhầm điểm bắt đầu — cảnh báo đó đúng nhưng **chưa đủ**. Có ít nhất **bảy** thứ đội lốt `role:"user"` mà không phải prompt của con người. Danh sách đầy đủ ở §12.

### Harness "dựng sân khấu" sau prompt

Ngay sau prompt của bạn, harness bơm các dòng `attachment`. Đọc lướt định dạng thường kể ra ba loại (`deferred_tools_delta`, `mcp_instructions_delta`, `opened_file_in_ide`) và gọi field là `subtype`. **Cả hai đều sai**: field là `attachment.type`, có **23** giá trị khác nhau, và loại phổ biến nhất (`skill_listing`) còn *nhiều hơn* `deferred_tools_delta`. "Sở thú" đầy đủ ở §11.

---

## 3. Token thực chất là gì, và `usage` thật ra chứa gì

Token là một mẩu dưới-từ (BPE hoặc biến thể riêng), không phải một từ. ✅ Transcript lưu **số đếm** token trong `message.usage` (chỉ trên dòng assistant) — **không bao giờ lưu chuỗi token**. Muốn thấy ánh xạ từ↔token bạn phải tự re-tokenize (mã hóa lại). 🟢 CONFIRMED — cạn kiệt: không field token-dạng-mảng nào tồn tại trong corpus, và bản mới nhất còn thêm `cache_missed_input_tokens`, vẫn chỉ là số vô hướng.

### `message.usage` — hình dạng thật

Đọc lướt thường liệt kê 4 field. Transcript hiện tại (2.1.172+) mang khoảng **10**:

```json
{"input_tokens":8436, "cache_creation_input_tokens":5065, "cache_read_input_tokens":16537,
 "output_tokens":478, "server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},
 "service_tier":"standard", "cache_creation":{"ephemeral_1h_input_tokens":5065,"ephemeral_5m_input_tokens":0},
 "inference_geo":"not_available", "iterations":[ … bản sao theo từng round-trip … ], "speed":"standard"}
```

> 🟢 Một `input_tokens` bé xíu (vd 65) **không** có nghĩa ít ngữ cảnh — phần còn lại đến qua `cache_read_input_tokens` (cache nóng) **hoặc** `cache_creation_input_tokens` (cache lạnh: turn đầu của phiên, và ngay sau mỗi `compact_boundary`). Nó chỉ *có xu hướng* co về một chữ số khi vào sâu phiên dài; một đoạn paste/tool-result lớn có thể đẩy nó vọt lên bất kể cache nóng đến đâu.

---

## 4. Một turn được tính thế nào

### 4.1 Định nghĩa

> **Một turn = một vòng đời xử lý prompt.** Nó mở khi user gửi prompt và đóng khi harness quyết định vòng lặp agent đã xong. ✅🟡

Vòng lặp agent: chừng nào message của assistant còn chứa block `tool_use`, harness chạy tool, đưa kết quả về, rồi gọi model lại — tới khi không còn nữa. ✅ Điều khiển thật của vòng lặp là "message có chứa block `tool_use`", chứ không phải nghĩa đen `stop_reason == "tool_use"` — transcript subagent đôi khi ghi `stop_reason:null` trên message vẫn có `tool_use` và vẫn được lặp.

Một turn cũng **không** luôn đóng ở `stop_reason:"end_turn"`. Trên corpus 480 lần đóng turn: 91,9% đóng bằng `end_turn`, **7,9% đóng bằng message lỗi-API tổng hợp** (`model:"<synthetic>"`, `stop_reason:"stop_sequence"`), và vài cái đóng thẳng từ `tool_result` của một tool lập lịch ("Nothing more to do this turn").

### 4.2 Field mỏ neo 🟢 CONFIRMED (kèm điều kiện)

Kết thúc một turn được đánh dấu bằng `type:"system"`, `subtype:"turn_duration"`, mang `durationMs` và `messageCount` (tích lũy, **tăng chặt** theo phiên). Ví dụ thật (v2.1.197):

```json
{"type":"system","subtype":"turn_duration","durationMs":118342,"messageCount":35,"version":"2.1.197"}
```

Nhưng hai điều kiện audit phát hiện:

- `turn_duration` **không phổ quát** — chỉ ~9% số file phiên có (những turn kết thúc sạch). Prompt bị ngắt (`[Request interrupted by user]`) hoặc bị bỏ dở (đóng phiên giữa chừng) **không** có mỏ neo nào. **Vắng mặt không phải là lỗi parser.**
- Khi có cấu hình **Stop hook**, kết-thúc-turn trở thành **hai** dòng system nối nhau: `stop_hook_summary` *rồi* `turn_duration` (`turn_duration.parentUuid` = `stop_hook_summary.uuid`). Chi tiết ở §9.

### 4.3 Một turn KHÔNG phải một lần gọi API 🟢 CONFIRMED

Ví dụ thật, truy vết được: một phiên pensieve, một turn, **4 `requestId`** khác nhau, nhưng đúng **1** `turn_duration` (`durationMs=54084, messageCount=33`). Việc model tự-sửa-giữa-turn (WebFetch gặp redirect 301 → fetch lại URL đã sửa ở round-trip kế, cùng turn) được kiểm chứng nguyên văn trong dữ liệu.

> 🟡 `requestId` cũng che các lần retry tầng vận chuyển. Một "bão retry" `api_error` có thể kéo một "round-trip" duy nhất tới ~60 phút với `retryAttempt` 1…10 trước khi xong (§9). Nên "`requestId` = một round-trip" thật ra là góc nhìn *đường-thành-công*.

### 4.4 Thời gian 🔴 REFUTED cho "ổn định ~0,2s"

Tuyên bố cũ cho rằng phần dư giữa thời gian tường (wall-clock) và `durationMs` ổn định ~0,2s. Không phải. Hai con số đó (0,218s, 0,198s) hóa ra là **2 turn được nhặt chọn trong 6** turn của cùng phiên; bốn cái còn lại là 111ms, 249ms, 3297ms, và 5071ms. Trên 472 turn của corpus, phần dư dao động từ ~0ms tới vài giây, và chỉ ~10% rơi vào dải 150–250ms như tuyên bố. Turn đầu của phiên trả nhiều hơn hẳn (chi phí bootstrap). Đó là **chi phí biến thiên theo từng turn**, không phải hằng số.

Tương tự, "`turn_duration` được ghi 3–7ms sau dòng assistant cuối" chỉ đúng khi không có gì chen giữa — đúng với 63% số turn. Có Stop hook, hoặc khoảng idle/away, phần chênh phình lên hàng trăm mili-giây, cực đoan tới ~24 phút.

---

## 5. Tìm ranh giới turn — quy tắc thực dụng, đã sửa

- 🔴 **Kết thúc turn:** dòng `subtype == "turn_duration"` — *khi có* (chỉ ~9% file có).
- 🟢 **Bắt đầu turn:** prompt `user` *thật* gần nhất phía trên — nhưng bộ lọc ngây thơ ("không `isMeta`, không `tool_result`") là **cần nhưng chưa đủ**. Nó định vị sai ~13% số turn vì các dòng harness khác cũng đội `role:"user"` mà không `isMeta` và không có block `tool_result`: task-notification, I/O của bash, stdout của local-command, tin nhắn teammate. Dùng danh sách loại trừ đầy đủ ở §12.
- ✅ **Lối tắt sạch dễ bỏ sót:** mọi dòng của một turn logic — prompt thật *và mọi `tool_result`* sinh ra khi trả lời nó — chia sẻ cùng một **`promptId`** (`null` trên dòng assistant). Thành viên của một turn là phép `group by promptId`, không phải đi ngược cây. Xem §10.

---

## 6. Errata: lần khảo sát đầu sai chỗ nào

Bản audit đối kháng trích 22 tuyên bố có thể phản nghiệm từ khảo sát gốc và đối chiếu từng cái với toàn corpus 1.107 transcript. Sáu cái sống nguyên vẹn; mười bốn cái cần thêm điều kiện; hai cái sai hẳn.

| # | Tuyên bố gốc | Phán quyết | Thực tế đã sửa |
|---|---|---|---|
| **E1** | "mỗi dòng một JSON, nối qua `uuid → parentUuid`" | 🟡 PARTIAL | Đúng cho 4 kiểu hội thoại (100% của 45.767 dòng). Nhưng ~15,5% số dòng file là bản ghi bookkeeping không `uuid` (11 kiểu) xen kẽ khắp nơi. |
| **E2** | 3 tác nhân; Harness = `attachment`/`system` + `tool_result` | 🟡 PARTIAL | Harness còn đội lốt `user` qua text bọc `isMeta` (454 dòng), và ghi ≥9 kiểu top-level nữa (`last-prompt`, `mode`, `ai-title`, …). Thêm tác nhân thứ 4: Teammate. |
| **E3** | `usage` có 4 field | 🟡 PARTIAL | Vị trí (chỉ assistant, trong `message.usage`) đúng chính xác; nhưng `usage` hiện mang ~10 khóa (thêm `server_tool_use`, `service_tier`, `cache_creation`, `inference_geo`, `iterations`, `speed`). |
| **E4** | `input_tokens` nhỏ ⇒ phần còn lại từ `cache_read` | 🟡 PARTIAL | Còn có `cache_creation_input_tokens` (cache lạnh: turn đầu / sau nén). "Co về một chữ số" là xu hướng, không phải luật. |
| **E6** | `requestId` trên dòng assistant = một lần gọi API | 🟡 PARTIAL | Nhóm gộp vững (1 req → 1..16 dòng, không xen kẽ). Nhưng ~48 dòng lỗi tổng hợp (`model:"<synthetic>"`, `isApiErrorMessage`) có `requestId:null`. |
| **E7** | mỗi content block = một dòng riêng, cách ~1ms | 🟡 PARTIAL | Chủ đạo (74,6%) nhưng không bất biến: 3 dòng corpus gộp 2–4 block (kể cả trên v2.1.197 mới nhất). "~1ms" chỉ đúng cho thinking→text; tách có `tool_use` trễ hàng giây→phút. |
| **E10** | 3 **subtype** attachment bơm sau prompt | 🔴 **REFUTED** | Không có khóa `subtype` — là `attachment.type`, với **23** giá trị. `skill_listing` (1128) > `deferred_tools_delta` (1117); `opened_file_in_ide` chỉ 22. Bộ ba chính xác là một tổ hợp *có điều kiện*, không phải bộ cố định. |
| **E11** | attachment dựng-sân-khấu ghi trong ~0ms | 🟡 PARTIAL | Đúng cho 3 loại được nêu (≤28ms). Attachment **nguồn-hook** ở cùng vị trí trễ tới ~1,1s (chúng chờ một shell hook thật). |
| **E12** | turn đóng ở `stop_reason:"end_turn"` | 🟡 PARTIAL | 91,9% end_turn; 7,9% đóng bằng lỗi-API `stop_sequence` tổng hợp; vài cái từ `tool_result` lập lịch. 36,7% `turn_duration` nối cha là `stop_hook_summary`/`away_summary`, không phải dòng assistant. |
| **E13** | điều kiện lặp = `stop_reason == "tool_use"` | 🟡 PARTIAL | Trình tự đúng chính xác (0 vi phạm). Nhưng điều khiển là "có block `tool_use`"; transcript subagent cho thấy `stop_reason:null` + tool_use vẫn được lặp (13 dòng / 6 file). |
| **E14** | kết thúc turn = một dòng `turn_duration` | 🟡 PARTIAL | Chỉ ~9% file có `turn_duration`. Có Stop hook thì là **hai** dòng (`stop_hook_summary` → `turn_duration`). Còn mang `messageCount`, `version`, đôi khi `pendingWorkflowCount`. |
| **E16** | `turn_duration` không được ghi tài liệu / phát hiện qua khảo sát | 🟡 PARTIAL | Nó được tài liệu hóa `@internal` trong binary CLI (kèm bộ field giàu hơn: `budget`, `pending_workflow_count`, …) cùng cờ `tengu_show_turn_duration_setting_changed`. Không có trang docs *công khai*; deepwiki cộng đồng đơn giản không đề cập dòng `system` nào. |
| **E19** | wall-clock − `durationMs` ≈ ổn định ~0,2s | 🔴 **REFUTED** | Nhặt chọn 2/6 turn; phần dư thật 111ms–5071ms trong cùng phiên, ~0ms–vài giây trên 472 turn. Bootstrap turn đầu chi phối. Chi phí biến thiên, không phải hằng số. |
| **E20** | `turn_duration` 3–7ms sau dòng assistant cuối | 🟡 PARTIAL | Chỉ ở 63% ca "trực tiếp" (và chỉ 71% trong đó là 3–7ms). Có Stop hook hoặc khoảng idle: 50ms → ~24 phút. |
| **E21** | turn bắt đầu = `user` gần nhất không `isMeta`/`tool_result` | 🟡 PARTIAL | Sót ~13% — còn phải loại `<task-notification>`, `<bash-input/stdout>`, `<local-command-stdout/caveat>`, `<teammate-message>`. Tốt hơn: `group by promptId`. |
| **E22** | mọi dòng mang `sessionId/cwd/gitBranch/version` | 🟡 PARTIAL | Chỉ 4 kiểu lõi (100%). Kiểu bookkeeping bỏ `cwd/gitBranch/version` (và vài kiểu bỏ cả `sessionId`). Các field này là **ảnh chụp theo dòng** — `version`/`gitBranch` đổi giữa file. |

CONFIRMED không đổi: **C5** (chỉ số đếm, không chuỗi token), **C8** (`tool_result` = user), **C9** (mẫu 5-trên-6), **C15** (`messageCount` đơn điệu), **C17** (4 requestId / 1 turn), **C18** (tự-sửa WebFetch giữa turn).

---

## 7. Subagent, sidechain & teammate — chỗ bỏ sót lớn nhất

Mô hình ngây thơ coi một phiên là một file khép kín. Thực tế subagent sống trong **file riêng** và báo cáo về qua một kênh trông y hệt prompt của user.

**Subagent là file riêng 🟢.** Một spawn `Task`/`Agent` ghi toàn bộ transcript của con vào `<sessionId>/subagents/agent-<name>-<hash>.jsonl` — **không** inline. Corpus có 34 thư mục `subagents/` chứa **865** transcript con. Chỉ mở file top-level thì bạn chẳng bao giờ biết có subagent chạy.

**Sidecar `.meta.json` 🟢.** Mỗi `agent-*.jsonl` có một `agent-*.meta.json` đi kèm, chứa thứ mà `.jsonl` không hề có: `agentType`, `spawnDepth`, `taskKind` (`in_process_teammate`), `teamName`, `color`, `model` (vd `claude-sonnet-4-6`), `permissionMode`. Đây là **nơi duy nhất** ghi model nào mà subagent thực sự dùng.

**`isSidechain` là thuộc tính cả-file 🟢.** `isSidechain:true` không bao giờ xuất hiện trong file phiên top-level (0 / 234). Nó là `true` trên **mọi** dòng của mọi file con, từ dòng 1. Một sidechain (nhánh phụ) là một file vật lý riêng, không phải công-tắc inline.

**Chuỗi đứt ở điểm spawn — `promptId`/`agentId` nối lại 🟢.** Dòng đầu của file con có `parentUuid: null` (gốc của cây riêng). Đi theo `parentUuid` vì thế **cụt ở điểm spawn**. Khóa nối liên-file là **`promptId`**: cùng giá trị đó gieo cho subagent và xuất hiện trên dòng cha nơi báo cáo của nó đáp về; `agentId` (chỉ có ở con) là nửa còn lại của "dấu vân tay".

**Tác nhân thứ 4: một phiên teammate đội lốt `user` 🟢.** `tool_result` của tool_use `Agent` chỉ là một **ack kiểu bắn-và-quên** ("Spawned successfully… will receive instructions via mailbox") — **không** phải sản phẩm. Khi subagent xong, nó gọi tool `SendMessage` của chính nó; báo cáo đáp vào file **cha** dưới dạng một dòng trông rất bình thường:

```
type: user   role: user   isSidechain: false   (không isMeta, không tool_result)
content (chuỗi thuần): "Another Claude session sent a message:
<teammate-message teammate_id="…" color="blue" summary="…">## …complete…"
```

> ⚠️ Dòng này vượt qua **mọi** bộ lọc §5 dành cho "prompt user thật", nhưng không con người nào gõ nó. Harness thậm chí nói rõ ngay trong luồng ở các ping idle: *"This came from another Claude session — not typed by your user…"* Mọi heuristic `role==user && !isMeta && !tool_result` sẽ phân loại nhầm chúng thành turn mới của con người.

**`Workflow` = nhiều subagent song song + một journal caching 🟢.** Một tool_use `Workflow` tỏa ra nhiều agent con dưới `subagents/workflows/wf_<runId>/agent-*.jsonl` (`spawnDepth:1`, sâu hơn một bậc so với `spawnDepth:0` của `Agent` thường), kèm một `journal.jsonl` cạnh đó ghi `{type:"started", key:"v2:<hash>", agentId}` và `{type:"result", key, result:{…}}`. `key` là hash nội dung, nên `Workflow({scriptPath, resumeFromRunId})` bỏ qua các agent đã cache khi chạy lại. `tool_result` phóng workflow lại chỉ là `status:"async_launched"` — kết quả thật nằm trong các file con cùng journal. *(Chính bản audit này là một workflow như vậy — 30 agent; journal chính là cách các phát hiện được cứu ra sau khi agent tổng hợp bị stall.)*

**`toolUseResult` mang metadata spawn 🟢🟡.** Dòng `tool_result` của spawn mang một `toolUseResult` đi kèm (không nằm trong `message.content`): `status` (`teammate_spawned`/`async_launched`), `model`, `team_name`, và bộ ba `tmux_session_name`/`tmux_window_name`/`tmux_pane_id` (ở đây luôn là `"in-process"`) cùng `is_splitpane:false` — hàm ý có chế độ teammate ngoài-tiến-trình dạng split-pane nhưng chưa được kích hoạt trong corpus này.

---

## 8. Compaction, summary & khôi phục phiên

Khi một phiên (hoặc một subagent fork) tích lũy quá nhiều token, harness **âm thầm viết lại lịch sử**. Không gì trong số này hiện ra với mô hình đếm-dòng ngây thơ.

**`compact_boundary` + `compactMetadata` 🟢.** Dòng mỏ neo: `type:"system"`, `subtype:"compact_boundary"`. Corpus có 4 (đều trong file subagent, đều `trigger:"auto"`):

| Field | Ví dụ | Ý nghĩa |
|---|---:|---|
| `preTokens` → `postTokens` | 597.661 → 9.297 | **giảm 95–98% token** mỗi lần |
| `durationMs` | 115k–244k ms | nén mất **2–4 phút** — ẩn, không `turn_duration` nào tính |
| `preservedSegment` | `{headUuid, anchorUuid, tailUuid}` | cửa sổ thô giữ nguyên văn |
| `preservedMessages.uuids` vs `.allUuids` | 5 vs 6 | `.allUuids` luôn nhiều hơn một — message **thứ 2** trong cửa sổ bị bỏ 🟢🟡 |

**Dòng recap tổng hợp (`isCompactSummary`) 🟢.** Ngay sau mỏ neo là một dòng `user` được chế tạo, gắn cờ `isCompactSummary:true` + `isVisibleInTranscriptOnly:true`, với `content` là bản recap dài do model viết (các mục cố định: *Primary Request, Key Technical Concepts, Files…, Errors and Fixes, … Optional Next Step*). Mọi lần đều kết bằng boilerplate giống hệt từng byte: *"…read the full transcript at: <path>. Continue… do not acknowledge the summary…"*

> Đây là kiểu đội-lốt `role:"user"` **thứ ba** ngoài `tool_result` và `isMeta` — không phải người, cũng không phải tool. Đường dẫn "read the full transcript at" luôn là file phiên *top-level*, kể cả khi nén xảy ra bên trong subagent — con trỏ liên-file duy nhất tới lịch sử đầy đủ.

**`logicalParentUuid` — field vá lại chuỗi đứt 🟢.** Ở `compact_boundary`, `parentUuid` là `null` (chuỗi bị cắt cố ý). Cầu nối là `logicalParentUuid`, trỏ về dòng sống-sót cuối cùng trước nén. Nó tồn tại **đúng** ở 4 file có `compact_boundary` và **không nơi nào khác**.

**Một fork có thể nén *trước khi làm gì* 🟢.** Mỗi `subagents/agent-*.jsonl` mở đầu bằng dòng `fork-context-ref` (`parentSessionId`, `parentLastUuid`, `contextLength`) — fork **thừa hưởng lịch sử của cha**. Nếu lịch sử đó đã lớn, hành động đầu tiên của fork là nén: trình tự thật là `fork-context-ref → một directive user → compact_boundary (preTokens 197.644, 115 giây)` với **zero** dòng assistant/tool_use/turn_duration ở giữa. Chi phí đó vô hình với mọi kế toán `turn_duration`/`requestId`.

**`away_summary` — một dòng "resume" *khác* 🟢.** `subtype:"away_summary"` là một recap "chào mừng quay lại" một dòng khi bạn trở lại phiên idle — nó **không** viết lại lịch sử. Nó có thể tự trở thành cha của một turn mà không có prompt người mới (một `turn_duration` thật ~52 phút nối thẳng từ một `away_summary` mà kích hoạt là idle-notification từ teammate khác). Nó khác `isCompactSummary`; cả hai phá vỡ quy tắc "prompt user thật gần nhất" ở §5.

---

## 9. Bộ đầy đủ các subtype của `system`

Đọc lướt định dạng thường dựng mọi thứ trên **một** trong **tám** subtype `system` thật:

| subtype | số lượng | nằm ở… | vai trò |
|---|---:|---|---|
| `turn_duration` | 479 | đóng một turn | mỏ neo cứng (§4.2) |
| `stop_hook_summary` | 207 | giữa assistant cuối & `turn_duration` | báo cáo Stop-hook; có thể *phủ quyết* việc dừng (xem dưới) |
| `away_summary` | 181 | sau khi turn đã đóng | recap "chào mừng quay lại" khi idle (§8) |
| `local_command` | 112 | giữa các turn | một slash command chạy phía client; không gọi model |
| `api_error` | 16 | trong một turn | lỗi tầng vận chuyển + retry backoff |
| `scheduled_task_fire` | 9 | mở một turn | một nhịp cron bơm lại prompt, không có người |
| `compact_boundary` | 4 | giữa các turn | sự kiện nén ngữ cảnh (§8) |
| `informational` | 3 | trong/giữa | nhắc nhở ngẫu hứng cho user (`"Backgrounding after the current tool finishes…"`) |

Còn có một trục mức độ **`level`** trực giao với `subtype` (`info`/`warning`/`error`/`suggestion` — corpus: 208/116/16/3). Lọc theo `level`, không phải `subtype`, nếu điều bạn muốn là "cái gì cần chú ý".

**Stop hook nằm giữa assistant và `turn_duration` 🟢.**

```json
{"subtype":"stop_hook_summary","hookCount":1,
 "hookInfos":[{"command":"python3 ~/.claude/scripts/wf-export.py --hook …","durationMs":193}],
 "hookErrors":[],"hookAdditionalContext":[],"preventedContinuation":false,"level":"suggestion"}
```

"Khoảng ~0,2s" ở §4.4 **chính là thời gian chạy của hook**: dòng assistant cuối tại `…14.137Z` → `stop_hook_summary` tại `…14.333Z` (196ms ≈ `durationMs` 193 của nó) → `turn_duration` tại `…14.335Z`. 🟡 `preventedContinuation` nghĩa là một hook có thể *từ chối* cho turn kết thúc (quay lại vòng lặp) — nên "model trả về không còn tool_use" là cần nhưng **chưa đủ** để đóng một turn. (Không có ví dụ `true` nào trong corpus này.)

**`local_command` — một cặp system không mở turn 🟢.** Các slash command như `/config`, `/model`, `/fork` là hai dòng `system`/`local_command` liên tiếp (lời gọi + `<local-command-stdout>`), không gọi model và không `turn_duration`. Khi quét ngược tìm điểm bắt đầu turn, **cũng bỏ qua chúng**.

**`api_error` — các retry mà `requestId` che 🟢.**

```json
{"subtype":"api_error","level":"error","error":{"message":"Request timed out."},
 "retryInMs":613.14,"retryAttempt":1,"maxRetries":10}
```

Một prompt sinh 4 `api_error` trong ~61 phút trước khi model đáp — và **không `turn_duration` nào từng được ghi** cho turn đó. ⚠️ Lưu ý phiên bản: cả 16 ví dụ đến từ một phiên v2.1.168; chưa xác nhận trên bản mới.

---

## 10. Các field định danh & cấu trúc cây

**Nó là CÂY, không phải chuỗi — và nhánh rất phổ biến 🟢.** **655 / 1106** file (59,2%) chứa một `parentUuid` được ≥2 dòng tham chiếu (5.271 điểm rẽ nhánh). Nguyên nhân số 1 **không** phải sửa prompt: là các content block `tool_use` tuần tự. Block nối `text → tool_use#1 → tool_use#2`, nhưng `tool_result` của mỗi block *cũng* nối cha là chính `tool_use` của nó — nên một block không-phải-cuối bị một `tool_result` anh-em tranh cùng cha với block kế. Chỉ một con được nối tiếp; con kia thành **lá cụt vĩnh viễn** với output tool thật nằm trong đó. Đi `parentUuid` ngây thơ kiểu một-con-mỗi-nút sẽ rớt output tool trên khoảng 6 trên 10 phiên.

**Hai "dấu vân tay" fork thật 🟢:**
1. **Fork khôi-phục-phiên** — khôi phục và gõ prompt mới sẽ nối lại vào nút *checkpoint* cuối (thường là một `system/away_summary`); khôi phục hai lần tạo hai con phân kỳ của cùng một cha, cách nhau nhiều ngày.
2. **Fork requeue-hàng-đợi** — một prompt `promptSource:"queued"` bị requeue sau lỗi xuất hiện hai lần (cùng text, `uuid` mới) trước khi prompt kế thật (`promptId` mới, `promptSource:"typed"`) thành anh-em của nó.

Không có sự kiện "edit" UI nào trong JSON — fork đến từ cơ chế khôi-phục/retry bình thường.

**`promptId` — khóa turn thật 🟢.** Mọi dòng `user` của một turn (prompt + mọi `tool_result` của nó) chia sẻ cùng một `promptId`; nó `null` trên dòng assistant. Thành viên turn là `group by promptId`, thay cho phép đi-ngược mong manh ở §5.

**`leafUuid` & các bookmark không-`uuid` 🟢.** `last-prompt`, `ai-title`, `mode`, `permission-mode`, `file-history-snapshot` **không** mang `uuid`/`parentUuid` — chỉ khóa bằng `sessionId`. `last-prompt.leafUuid` nêu tên ngọn-cây để khôi phục; `file-history-snapshot.messageId` là bí danh của `uuid` một dòng thật.

**`parentUuid` bị overload; `sourceToolAssistantUUID` làm rõ 🟢.** `parentUuid` mang ba nghĩa khác nhau tùy kiểu dòng: block trước của cùng message / `tool_use` mà một `tool_result` đáp lại / thứ cuối cùng thấy trước một prompt mới. Harness ship một field chuyên dụng trên mọi `tool_result` — **`sourceToolAssistantUUID`** (923/1107 file) — trỏ tới dòng `tool_use` gốc. Coi nó (hoặc cặp `tool_use_id ↔ block id`) là liên kết gọi↔kết-quả chuẩn; coi `parentUuid` chỉ là vị-trí-cây.

**Metadata là ảnh chụp theo dòng 🟢.** `version`/`gitBranch`/`cwd` đổi **giữa file**: một phiên ghi `2.1.185` rồi `2.1.186` mười bốn phút sau (CLI tự cập nhật không khởi động lại); 30 file mang ≥2 giá trị `gitBranch`, một file cho thấy bốn lần chuyển. **Đọc các field này từ đúng dòng**, không phải một lần từ dòng 1.

**Bảng tra định danh:**

| Field | Phạm vi |
|---|---|
| `uuid` | dòng này |
| `parentUuid` | vị trí cây (nghĩa đổi theo kiểu dòng) |
| `message.id` / `requestId` | một lần gọi API (1:1) |
| `promptId` | một turn logic |
| `sessionId` | cả file |
| `leafUuid` / `file-history-snapshot.messageId` | con trỏ *vào* cây, cho bookkeeping khôi-phục/tua-lại |

---

## 11. `toolUseResult`, payload tràn đĩa, ảnh & "sở thú" attachment

**`toolUseResult` — bản sao có cấu trúc của `message.content` 🟢.** `content` là thứ **model** đọc; `toolUseResult` (top-level, cùng dòng) là bản sao có cấu trúc của harness, hình dạng theo từng tool:

| Tool | Hình dạng `toolUseResult` |
|---|---|
| `Read` (text) | `{type:"text", file:{filePath, content, numLines, startLine, totalLines}}` |
| `Read` (ảnh) | `{type:"image", file:{base64, type, originalSize, dimensions:{…}}}` |
| `Bash` | `{stdout, stderr, interrupted, isImage, noOutputExpected}` |
| `SlashCommand` | `{success, commandName}` |

Vài dữ liệu **chỉ** nằm ở đây — `dimensions` pixel của ảnh, `totalLines` của `Read`, `interrupted` của `Bash`. 280/1107 file có nó.

**Payload lớn tràn ra sidecar `tool-results/` 🟢.** Kết quả lớn hoặc nhị phân được ghi vào `<sessionId>/tool-results/<tool_use_id>.txt` (hoặc `webfetch-<ts>.pdf`) và được tham chiếu từ dòng: text `tool_result` của một WebFetch PDF ghi thẳng *"[Binary content (application/pdf, 749.9KB) also saved to …/tool-results/webfetch-….pdf]"*. Có 21 thư mục như vậy, file tới 3,35 MB. ⚠️ Không phổ quát — một PNG 2,4 MB được nhúng base64 inline **không** có sidecar; ngưỡng cắt là một heuristic 🟡 theo kích thước/kiểu. Một sắc thái đáng biết: bản text hướng-tới-model mang tiền tố số dòng `N\t` (kiểu `cat -n`); `toolUseResult.file.content` là bản gốc thô.

**`isApiErrorMessage` — một dòng assistant giả 🟢.** Khi lỗi API **cuối cùng** (rate-limit, billing, auth, model id sai), harness chế ra một dòng assistant: `model:"<synthetic>"`, `isApiErrorMessage:true`, `stop_reason:"stop_sequence"`, `content` đọc-được cho người (*"You've hit your session limit…"*). 98 dòng trong corpus, 6 kiểu lỗi. Khác với `system/api_error` tạm thời (có retry, §9). Dấu hiệu: `model=="<synthetic>"`.

**`isMeta` và ảnh 🟢.** `isMeta:true` là một caveat harness-bơm bọc output local-command (vd `<local-command-caveat>`), `role:"user"` — kẻ đội lốt thứ hai sau `tool_result`. 454 dòng mang nó. Và có một **content-block thứ năm, `image`** (7 file): người-dán (top-level, với dấu `[Image #1]` trong block text) hoặc tool-sinh (lồng trong mảng `tool_result.content`). Attachment `file` có hai hình: `content.type:"text"` (nguyên văn) vs `"file_unchanged"` (stub cache-hit — bản tương tự cấp-file của `cache_read_input_tokens`).

**"Sở thú" attachment — 23 kiểu, không phải 3 🟢:**

| `attachment.type` | số lượng | là gì |
|---|---:|---|
| `skill_listing` | 1128 | mô tả mọi skill đã cài, gửi lại mỗi turn |
| `deferred_tools_delta` | 1117 | schema tool trì-hoãn vừa khả dụng |
| `task_reminder` | 506 | ảnh chụp TaskList hiện tại, bơm giữa vòng lặp |
| `mcp_instructions_delta` | 141 | hướng dẫn dùng MCP |
| `output_style` | 137 | style hiện hành, vd `{"style":"Explanatory"}` |
| `agent_listing_delta` | 84 | các kiểu subagent khả dụng |
| `command_permissions` | 82 | `{"allowedTools":[…]}` |
| `hook_success` / `_non_blocking_error` / `_cancelled` | 75 / 7 / 1 | kết quả hook |
| `queued_command` | 71 | một lệnh đang chờ giao |
| `edited_text_file` / `nested_memory` / `diagnostics` / `file` | 58 / 43 / 36 / 3 | tín hiệu IDE & file |
| `date_change`, `ultra_effort_*`, `ultrathink_effort`, `selected_lines_in_ide`, `opened_file_in_ide`, `workflow_keyword_request`, `plan_mode_exit`, `goal_status` | 19 / 14 / 2 / 10 / 22 / 4 / 1 / 1 | dấu mốc chế-độ/phiên |

**Slash command: hai họ, một lớp bọc thiếu nhất quán 🟢.** Một `/command` gõ vào là một dòng `type:"user"` bình thường mà `content` là một **chuỗi thuần** (không phải mảng block) bọc trong `<command-name>/<command-message>/<command-args>`.
- **Built-in** (`/clear`, `/model`): `command-name` trước, thụt 12 dấu cách, `command-args` rỗng; phần trả về là `<local-command-stdout>` trên một dòng có `type` ngoài *không nhất quán* — `system/local_command` **hoặc** `user` thuần (corpus chia: 106 user / 67 system / 18 assistant).
- **Skill-backed** (`/deep-research`, `/c3`, custom): thứ tự tag đảo ngược, `command-args` có nội dung, và ngay sau lớp bọc là một **dòng `user` thứ hai `isMeta:true` bơm thân file của skill** — *dòng đó*, không phải lớp bọc, mới là prompt thật điều khiển vòng lặp.
- **Chế độ `!`-bash**: một kênh thứ ba hoàn toàn — `<local-command-caveat>` (isMeta) rồi các dòng `<bash-input>` / `<bash-stdout><bash-stderr>`, **không round-trip model**, và các dòng bash **không** mang `isMeta` — thêm một bẫy cho bộ lọc §5.

---

## 12. Danh sách tổng: mọi thứ đội lốt `role:"user"` mà không phải prompt người

Đọc lướt tìm ra một kẻ đội lốt (`tool_result`). Audit tìm ra **bảy**. Một bộ lọc tìm-điểm-bắt-đầu-turn / "con người thật ra hỏi gì" chắc chắn phải loại trừ **tất cả**:

| # | Kẻ đội lốt | Cách nhận diện |
|---|---|---|
| 1 | Kết quả tool | `message.content[].type == "tool_result"` (còn có `toolUseResult`) |
| 2 | Caveat / text bơm bởi harness | `isMeta == true` |
| 3 | Recap sau nén | `isCompactSummary == true` (+ `isVisibleInTranscriptOnly`) |
| 4 | Ping tác vụ/workflow nền | content bắt đầu `<task-notification>` |
| 5 | I/O chế độ `!`-bash | content bắt đầu `<bash-input>` / `<bash-stdout>` |
| 6 | stdout của slash-command | content bắt đầu `<local-command-stdout>` / `<local-command-caveat>` |
| 7 | Một phiên Claude khác | content bắt đầu `Another Claude session sent a message:` / `<teammate-message>` |

> ✅ **Tín hiệu sạch khiến cả danh sách này thành thừa:** `promptSource` (`typed`/`sdk`/`queued`/`suggestion_accepted` = có nguồn con người; **`system`** = harness-tổng-hợp, không có người) và `origin.kind` (`human`/`task-notification`/`coordinator`). Một turn có thể mở **không cần hành động người nào** — một `scheduled_task_fire` bơm lại prompt nguyên văn với `promptSource:"system"`. Ưu tiên `promptSource`/`origin` hơn là "đánh hơi" chuỗi khi field có mặt.

---

## Nguồn

- Stop reason & vòng lặp tool-use, và prompt caching & các field usage — tài liệu API chính thức của Anthropic.
- Một tham chiếu JSONL cộng đồng (deepwiki `simonw/claude-code-transcripts`) cũng đã được kiểm tra, nhưng nó chỉ bao gồm `summary`/`user`/`assistant`/`file-history-snapshot` — không có dòng `system` nào.
- Chuỗi doc `@internal` của `turn_duration` được trích thẳng từ binary CLI đã ship.
- **Ground-truth cho mọi thứ gắn nhãn 🟢**: 1.107 transcript `.jsonl` thật dưới `~/.claude/projects`, trải các phiên bản CLI 2.1.168 → 2.1.197.
