---
title: "Đổi Provider & Bên Trong SDK Mode: Agent Harness Kết Nối query() của Claude In-Process Ra Sao"
description: "Hầu hết agent harness che giấu nhiều thứ hơn README thú nhận. Bài này truy vết một tin nhắn chat từ WebSocket đến token pool — bao gồm gọi SDK trong tiến trình so với spawn subprocess, seam HarnessEvent giúp provider có thể hoán đổi, và cơ chế xoay OAuth token khi gặp rate-limit và 401."
pubDatetime: 2026-07-16T09:00:00Z
lang: vi
tags:
  - claude-code
  - claude-agent-sdk
  - ai-agents
  - architecture
  - oauth
  - provider-abstraction
  - vietnamese
multiLangKey: "provider-switching-sdk-internals"
---

Hầu hết README của agent harness (bộ khung chạy agent) đều hứa hẹn "hỗ trợ nhiều provider" rồi để bạn tự đoán cơ chế thật sự. Model được gọi trong tiến trình hay spawn thành subprocess (tiến trình con)? Làm sao đổi provider mà không phá vỡ mọi consumer phía trên? Và khi pool nhiều tài khoản OAuth để tăng ngưỡng burst, cái gì ngăn một token đã bị rate-limit âm thầm làm hỏng cả cuộc trò chuyện?

Bài này truy vết một tin nhắn chat — từ lúc WebSocket nhận được cho đến tận token pool (hồ token) — qua một agent harness thật được xây dựng trên Claude Agent SDK và Codex. Các đường code bên dưới là thật; tên nội bộ và đường dẫn đã được khái quát hoá.

## Tóm tắt nhanh (TL;DR)

1. **Harness không shell-out `claude -p`.** Ở SDK mode (chế độ SDK), nó import `query` từ `@anthropic-ai/claude-agent-sdk` và gọi trực tiếp bên trong tiến trình server. `query()` trả về một async generator (bộ sinh bất đồng bộ); harness tiêu thụ nó bằng `for await`. Không có subprocess nào, không có pipe stdout — từ góc nhìn của harness, đây chỉ là một async iterator bình thường.

2. **"Đổi provider" nghĩa là chọn driver và chuẩn hoá output.** Ba provider (`claude`, `codex`, `openrouter`) ánh xạ thành hai driver. Một hàm kiểm tra `isClaudeSdkProvider()` quyết định rẽ nhánh: `claude` và `openrouter` dùng chung SDK driver; `codex` có subprocess driver riêng. Cả hai driver đều tạo ra cùng một đối tượng `HarnessTurn` với `stream: AsyncIterable<HarnessEvent>` — đây là seam (đường nối) giúp phần còn lại của hệ thống không cần biết đang chạy provider nào.

3. **Codex mới thực sự là subprocess.** Codex driver spawn `codex app-server` và nói chuyện qua JSON-RPC trên stdio. Đây là điều ngược lại hoàn toàn so với đường SDK — cùng kiểu output (`HarnessEvent`), khác cơ chế.

4. **Token pool: lease (thuê) dính chat, trải tải + LRU.** Mỗi turn mượn một token từ pool các tài khoản OAuth. Pool chọn token theo số owner (chủ sở hữu đồng thời) ít nhất, rồi tới ít dùng gần nhất (LRU). Token được chọn sẽ được tiêm vào env của SDK dưới dạng `CLAUDE_CODE_OAUTH_TOKEN`. Khi gặp 401 hoặc rate-limit, pool đánh dấu token đó hỏng, chọn token tiếp theo hợp lệ, và chạy lại turn — với cửa sổ deduplication (loại trùng lặp) để nhiều chat cùng dùng chung token không cùng trigger rotation một lúc.

---

## 1. Đường đi của request — từ Enter đến model

Năm bước đứng giữa "người dùng nhấn Enter" và "SDK đang chạy":

```
Browser
  │  (WebSocket: chat.send)
  ▼
ws-router.ts          nhận message, gọi AgentCoordinator.send()
  ▼
AgentCoordinator.send()
  │  kiểm tra hợp lệ, mở/tạo chat, tuỳ chọn chèn turn /compact
  ▼
AgentCoordinator.startTurnForChat()
  │  set provider + model, tạo đối tượng HarnessTurn
  │
  ├─ isClaudeSdkProvider(provider) === true  ──► startClaudeTurn()
  │                                                    │
  │                                                    ▼
  │                                            startClaudeSession()
  │                                            └─ query({ prompt, options })  ← gọi SDK
  │
  └─ provider === "codex"  ──► codexManager.startSession() + startTurn()
                                    │
                                    ▼
                             spawn("codex", ["app-server"])
                             └─ JSON-RPC qua stdio
```

Cả hai nhánh đều resolve thành một `HarnessTurn`, với `.stream` là `AsyncIterable<HarnessEvent>`. Vòng lặp consumer (tiêu thụ) — `runClaudeSession()` — lặp qua stream đó và không cần biết nhánh nào tạo ra nó.

---

## 2. Đổi provider: ba provider, hai driver, một interface

### 2.1 Danh mục provider

Mỗi provider khai báo `defaultModel`, danh sách model, và aliases (tên thay thế) tuỳ chọn. Hàm `normalizeProviderModelId` resolve một chuỗi model tuỳ ý thành cặp `(provider, modelId)` chuẩn bằng cách khớp với các id và alias đã khai báo, rơi về default của provider nếu không tìm thấy.

Kiểu provider đơn giản là:

```ts
export type AgentProvider = "claude" | "codex" | "openrouter";
```

### 2.2 Rẽ nhánh driver

Việc rẽ nhánh xảy ra trong `startTurnForChat()`:

```ts
let turn: HarnessTurn
if (isClaudeSdkProvider(args.provider)) {
  turn = await this.startClaudeTurn({ ... })         // claude + openrouter
} else {
  const sessionToken = await this.codexManager.startSession({ ... })
  turn = await this.codexManager.startTurn({ ... })  // codex
}
```

`isClaudeSdkProvider` cố tình giữ đơn giản:

```ts
export function isClaudeSdkProvider(provider: AgentProvider): boolean {
  return provider === "claude" || provider === "openrouter";
}
```

`openrouter` đi qua cùng đường SDK với `claude` vì nó phơi ra một endpoint (điểm cuối) tương thích Anthropic — chỉ khác nhau ở các biến env (base URL + auth token thay vì OAuth token).

### 2.3 Seam (đường nối) chuẩn hoá: `HarnessTurn` và `HarnessEvent`

Đây là thứ làm cho các provider thực sự có thể thay thế lẫn nhau:

```ts
export interface HarnessEvent {
  type: "transcript" | "session_token" | "rate_limit";
  entry?: TranscriptEntry; // dòng transcript đã chuẩn hoá
  sessionToken?: string; // handle nối phiên, mờ đục với harness
  rateLimit?: { resetAt: number; tz: string };
}

export interface HarnessTurn {
  provider: AgentProvider;
  stream: AsyncIterable<HarnessEvent>; // ← seam chung
  getAccountInfo?: () => Promise<AccountInfo | null>;
  interrupt: () => Promise<void>;
  close: () => void;
}
```

Mọi thứ phía trên interface này — WebSocket routing, lưu transcript, đẩy real-time lên UI — đều mù với provider. Mọi thứ phía dưới nó là đặc thù provider.

---

## 3. SDK mode: `query()` in-process, không phải `claude -p`

### 3.1 "In-process" nghĩa là gì

Harness import `query` từ `@anthropic-ai/claude-agent-sdk` ở đầu file server và gọi nó như một async function bình thường:

```ts
const q = query({
  prompt: promptQueue,           // AsyncMessageQueue<SDKUserMessage>
  options: {
    cwd: args.localPath,
    model: args.model,
    effort: toSdkEffort(args.effort),
    resume: args.sessionToken ?? undefined,   // nối tiếp phiên cũ
    forkSession: args.forkSession,
    permissionMode: args.planMode ? "plan" : "acceptEdits",
    canUseTool,                               // hook duyệt tool
    mcpServers: { ... },
    systemPrompt: { type: "preset", preset: "claude_code", append: ... },
    env: buildClaudeEnv(process.env, args.oauthToken, ...),
  },
})
```

`q` có kiểu `Query` — một `AsyncIterable`. Harness tiêu thụ nó bằng `for await (const m of q)`. Không có `child_process.spawn("claude", ["-p", ...])` nào ở tầng harness. SDK có thể tự quản subprocess bên trong (điều đó mờ đục với harness), nhưng harness chỉ thấy một async generator để lặp qua.

`promptQueue` là một `AsyncMessageQueue<SDKUserMessage>`. Turn đầu tiên push prompt rồi (trừ khi dùng chế độ keep-alive) đóng queue. Các turn sau push tiếp vào cùng queue — đây là cơ chế streaming-input (đầu vào luồng) gốc của SDK cho cuộc trò chuyện nhiều turn.

### 3.2 Output SDK → `HarnessEvent` như thế nào

Hai adapter (bộ chuyển đổi) mỏng nằm giữa output thô của SDK và harness stream:

**`toClaudeMessageStream(q)`** — lọc output SDK, chỉ giữ các message hướng về Claude:

```ts
async function* toClaudeMessageStream(q: Query) {
  for await (const m of q) {
    if (isSdkToClaudeMessage(m)) yield m;
  }
}
```

**`createClaudeHarnessStream(...)`** — ánh xạ mỗi message đã lọc thành một `HarnessEvent`:

- Message mang `session_id` → `{ type: "session_token", sessionToken }`
- `type === "rate_limit_event"` → `{ type: "rate_limit", ... }`
- `type === "assistant"` và các loại nội dung khác → `TranscriptEntry` chuẩn hoá → `{ type: "transcript", entry }`

Kết quả là thuộc tính `.stream` của `ClaudeSessionHandle` được trả về, và nó trở thành `HarnessTurn.stream`.

### 3.3 Tính liên tục phiên: tại sao turn 2 "nhớ" turn 1

SDK phát ra `session_id` trong mỗi message. Harness bắt nó:

```ts
if (event.type === "session_token" && event.sessionToken) {
  session.sessionToken = event.sessionToken;
  await this.store.setSessionTokenForProvider(
    session.chatId,
    "claude",
    event.sessionToken
  );
}
```

Turn tiếp theo đọc lại nó và truyền vào `query()` qua `resume:`. SDK dùng handle đó để tiếp tục conversation (cuộc trò chuyện) cũ thay vì bắt đầu lại từ đầu.

Xoá `sessionToken` do đó là cơ chế đứng sau mọi thao tác "bắt đầu context mới": turn tiếp theo trở thành phiên Claude hoàn toàn mới, không có lịch sử cuộc trò chuyện trước đó.

### 3.4 Đường Codex để đối chiếu

```
codexManager.startTurn()
  └─ spawn("codex", ["app-server"], { stdio: ["pipe","pipe","pipe"] })
       │
       ▼  (các dòng JSON-RPC qua stdio)
  CodexAppServerManager
       │  parse notification: turn/started, item/completed, ...
       ▼
  ánh xạ mỗi notification → HarnessEvent
       ▼
  cùng interface HarnessTurn.stream
```

|                  | Claude (SDK mode)                                     | Codex                                            |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Cơ chế           | `query()` in-process, async generator                 | `spawn("codex", ["app-server"])`, JSON-RPC stdio |
| Nối phiên        | Trường `resume: sessionToken` trong options `query()` | Tin nhắn JSON-RPC `thread/resume`                |
| Kiểu sự kiện gốc | `SDKMessage`                                          | `turn/started`, `item/completed`, …              |
| Chuẩn hoá thành  | `createClaudeHarnessStream` → `HarnessEvent`          | `CodexAppServerManager` → `HarnessEvent`         |

---

## 4. Token pool: nhiều tài khoản OAuth, xoay vòng theo turn

### 4.1 Tại sao OAuth token chứ không phải API key

OAuth token mang danh tính người đăng ký. Chi phí billed qua OAuth được tính vào gói subscription (đăng ký) của tài khoản đó; chi phí qua API key thô được tính theo giá pay-per-token (trả theo token). Harness chỉ dùng OAuth vì lý do này.

`buildClaudeEnv` thực thi điều này bằng cách bóc mọi `CLAUDE_CODE_OAUTH_TOKEN` kế thừa từ process cha, rồi tiêm token mà pool đã chọn:

```ts
export function buildClaudeEnv(baseEnv, oauthToken, openrouter?) {
  const { CLAUDECODE: _u, CLAUDE_CODE_OAUTH_TOKEN: _o, ...rest } = baseEnv; // bóc token kế thừa
  if (openrouter) {
    return {
      ...rest,
      ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
      ANTHROPIC_AUTH_TOKEN: openrouter.apiKey,
      ANTHROPIC_API_KEY: "",
    };
  }
  if (!oauthToken) {
    return baseEnv.CLAUDE_CODE_OAUTH_TOKEN
      ? { ...rest, CLAUDE_CODE_OAUTH_TOKEN: baseEnv.CLAUDE_CODE_OAUTH_TOKEN }
      : rest;
  }
  return { ...rest, CLAUDE_CODE_OAUTH_TOKEN: oauthToken }; // ← token được pool chọn
}
```

Đối tượng env này được truyền thẳng vào options của `query()`. SDK đọc `CLAUDE_CODE_OAUTH_TOKEN` từ đó — token không bao giờ thoát ra ngoài execution context (ngữ cảnh thực thi) của turn.

### 4.2 Cấu trúc một token entry

Mỗi tài khoản trong pool được biểu diễn là:

```ts
interface OAuthTokenEntry {
  id: string;
  label: string; // tên tài khoản đọc được
  token: string; // giá trị OAuth bearer thật
  status: "active" | "limited" | "error" | "disabled";
  limitedUntil: number | null; // epoch ms khi rate-limit hết
  lastUsedAt: number | null; // để chọn LRU
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  addedAt: number;
  maxConcurrent?: number; // trần concurrency (đồng thời) cho token này (1–5)
}
```

Token được lưu trong file settings của harness. Map ownership (quyền sở hữu) trong RAM — theo dõi chat ID nào đang giữ lease (thuê) của token nào — không được lưu xuống đĩa và reset khi process khởi động lại.

### 4.3 `pickActive` chọn token ra sao

Thuật toán chọn là trải tải + LRU + sticky-lease (giữ nguyên), không phải round-robin (xoay vòng đều):

1. **Sticky re-entry (vào lại giữ nguyên).** Nếu `chatId` này đang giữ một token hợp lệ, trả về đúng token đó ngay. Ngăn một chat bị nhảy token giữa các lần gọi `pickActive` trong cùng một turn.

2. **Lọc ứng viên hợp lệ.** Loại token có status `error` hoặc `disabled`; loại token đã đạt hoặc vượt trần `maxConcurrent`; loại token `limited` mà `limitedUntil` còn ở tương lai.

3. **Xếp hạng.** Trong số token hợp lệ, ưu tiên token có ít owner đang dùng nhất (trải tải). Hoà thì chọn `lastUsedAt` nhỏ nhất (ít dùng gần nhất — LRU).

4. **Cấp lease.** Thêm `chatId` vào owner set của token. Một chat giữ tối đa một token tại một thời điểm.

Hiệu quả: token không được xoay đều — chúng được trải để cân tải, sau đó giữ ổn định cho một chat để duy trì prompt-cache locality (vị trí cache prompt) và tôn trọng giới hạn concurrency của từng tài khoản.

Nếu pool tồn tại nhưng không có token nào hợp lệ lúc gọi, harness ném ra một lỗi tường minh thay vì lặng lẽ fall back về credential (thông tin xác thực) nào đó trong môi trường xung quanh.

### 4.4 Rotation on failure (xoay token khi hỏng)

**Rate-limit** — phát hiện theo hai cách: SDK phát `rate_limit_event`, hoặc trình quét text tìm thấy mẫu rate-limit trong result text. Phản hồi: `pool.markLimited(id, resetAt)` → `pool.pickActive(chatId)` chọn token tiếp → phiên cũ bị tear down (giải phóng) (giữ reservation cho token mới) → turn được lên lịch retry với `source: "token_rotation"`.

**Lỗi xác thực 401** — phát hiện bằng cách khớp result text và debug output với các chuỗi lỗi đã biết (`api_error_status.*401`, `401 Invalid authentication credentials`, `"type":"authentication_error"`). Phản hồi: `pool.markError(id, reason)` (giải phóng mọi reservation) → `pool.pickActive(chatId)` → retry ngay (không có cửa sổ chờ, khác với rate-limit phải đợi tới `limitedUntil`).

Một deduplication window (cửa sổ loại trùng lặp) (`TOKEN_ROTATION_DEDUPE_WINDOW_MS`) và rotation slot lock ngăn nhiều chat cùng dùng chung token hỏng đều trigger rotation đồng thời.

---

## 5. Vòng đời đầy đủ của một turn ở SDK mode

```
1. Browser gửi chat.send qua WebSocket
2. ws-router chuyển đến AgentCoordinator.send()
3. AgentCoordinator.startTurnForChat() — set provider, tạo HarnessTurn
4. isClaudeSdkProvider() rẽ sang startClaudeTurn()
5. pool.pickActive(chatId) — thuê một OAuth token (trải tải + LRU)
6. startClaudeSession():
     env = buildClaudeEnv(process.env, token)   ← tiêm CLAUDE_CODE_OAUTH_TOKEN
     q   = query({ prompt: queue, options: { env, resume: sessionToken, model, ... } })
                                                 ← in-process, KHÔNG phải claude -p
7. stream = createClaudeHarnessStream(toClaudeMessageStream(q))
                                     ← SDKMessage → HarnessEvent
8. runClaudeSession(): for await (event of stream)
     - sự kiện session_token → lưu, dùng làm resume ở turn sau
     - rate_limit / 401      → markLimited/markError → pickActive → retry
     - sự kiện transcript    → lưu vào store, đẩy lên UI qua WebSocket
9. Stream cạn → turn kết thúc; lease token giữ nguyên cho turn kế
```

---

## 6. Bài học thiết kế

**Seam mới là thiết kế.** `HarnessTurn` với `stream: AsyncIterable<HarnessEvent>` là interface duy nhất mà phần còn lại của hệ thống chạm vào. Thêm provider thứ tư nghĩa là implement interface đó — không có gì phía trên cần thay đổi.

**In-process hay subprocess là quyết định ở tầng driver.** SDK của Claude là in-process theo bản chất; Codex yêu cầu subprocess. Harness không chọn — driver của provider chọn, và nó ẩn lựa chọn đó phía sau `HarnessTurn`.

**Billing OAuth-only là ràng buộc kiến trúc, không phải cấu hình.** `buildClaudeEnv` bóc mọi API key xung quanh trước khi tiêm pool token. Không có đường "fall through về API key" nào cho các turn được quản lý bởi pool — harness hoặc có OAuth token hợp lệ, hoặc ném lỗi.

**Sticky lease bảo vệ tỷ lệ prompt-cache hit.** Cho phép một chat giữ cùng token qua nhiều turn không chỉ là tiện lợi — nó còn nghĩa là KV cache của provider cho conversation đó có nhiều khả năng còn ấm ở các turn kế tiếp, giảm cả latency (độ trễ) lẫn chi phí.

**Rotation on failure là tường minh, không phải ngầm định.** Không có chu kỳ `markLimited`/`markError` → retry của pool, một token hỏng có thể âm thầm chặn cả một chat, hoặc tệ hơn là harness fall back về một credential nó không bao giờ được phép dùng. Làm cho failure mode (chế độ lỗi) rõ ràng và rotation có chủ đích là thứ làm cho multi-account pooling an toàn về mặt vận hành.
