---
title: "Claude Agent SDK: flow đơn giản nhất và cách viết tool của riêng mình"
description: "Dùng @anthropic-ai/claude-agent-sdk để điều khiển Claude bằng TypeScript — từ query() và env-var auth, tới subagent qua Task tool, rồi tự viết in-process MCP tool bằng createSdkMcpServer()."
pubDatetime: 2026-07-17T02:00:00Z
tags: ["claude-agent-sdk", "mcp", "tools", "agent", "vietnamese"]
lang: "vi"
---

## Tóm tắt nhanh (TL;DR)

- `@anthropic-ai/claude-agent-sdk` là package TypeScript bọc quanh CLI `claude`, cho phép code TS/JS điều khiển một phiên Claude Code.
- Entry point duy nhất: `query({ prompt, options })` — trả về object vừa là async-iterable vừa là control handle.
- Auth: không có hàm login, chỉ là env var — `CLAUDE_CODE_OAUTH_TOKEN` (subscription) hoặc `ANTHROPIC_API_KEY` (API trả theo token).
- Subagent: khai báo trong `options.agents`, gọi qua built-in `Task` tool — phải có `"Task"` trong `allowedTools`.
- Custom tool: `tool()` + `createSdkMcpServer()` tạo in-process MCP server (server MCP chạy ngay trong tiến trình của mình), gắn vô `options.mcpServers`, gọi theo địa chỉ `mcp__<serverName>__<toolName>`.

---

Gần đây tui cần viết một đoạn code TypeScript tự động chạy Claude, truyền cho nó một subagent, và nhận kết quả về. Nhìn vô docs thấy `@anthropic-ai/claude-agent-sdk` — bọc quanh CLI `claude` và expose API TypeScript sạch sẽ. Bài này ghi lại những gì tui thấy thiết thực nhất, bỏ qua mấy thứ phức tạp không cần thiết ở giai đoạn đầu.

## 1. SDK là gì — entry point `query()`

`@anthropic-ai/claude-agent-sdk` (gọi tắt là Agent SDK) là một package TypeScript bọc quanh CLI `claude`. Thay vì subprocess + parse stdout thủ công, SDK cho bạn một hàm: `query({ prompt, options })`.

Gọi `query()` trả về một object `Query` có **hai vai trò cùng lúc**:

1. **Async-iterable** — `for await` qua nó để nhận stream `SDKMessage`: tool call, text chunk, và cuối cùng là `result`.
2. **Control handle** — cùng object đó có các method điều khiển giữa chừng: `interrupt()`, `setModel(name)`, `setPermissionMode(mode)`, `supportedCommands()`.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk"

const session = query({ prompt: "Say hello", options: {} })
// `session` vừa là iterable (for-await) vừa có interrupt/setModel/…
for await (const message of session) {
  console.log(message)
}
```

Field `prompt` nhận hoặc một string thường (single-turn) hoặc một `AsyncIterable<SDKUserMessage>` — một queue mở để push thêm turn sau (cách Kanna dùng cho multi-turn). Giai đoạn đầu, plain string là đủ.

## 2. Auth — đơn giản nhất có thể

Không có hàm `auth()` hay `login()` nào để gọi. Auth hoàn toàn là biến môi trường (environment variable). Chọn một trong hai:

| Biến | Mô hình tính phí | Lấy ở đâu |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Subscription (Pro/Max) | Chạy `claude setup-token` trên CLI, copy token nó in ra |
| `ANTHROPIC_API_KEY` | Trả theo token (API) | Anthropic console → API keys |

Set trong shell trước khi chạy, hoặc set `process.env` trong code:

```typescript
// Auth đơn giản nhất — set trước khi gọi query()
process.env.CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oat-..."  // HOẶC
// process.env.ANTHROPIC_API_KEY = "sk-ant-api-..."
```

SDK đọc biến lúc khởi tạo session. Đó là toàn bộ "auth handshake". Không cần gì thêm.

## 3. Flow đơn giản nhất — main agent + một subagent

**Subagent** (tác nhân con) trong SDK là một agent được khai báo inline dưới `options.agents`. Main agent gọi nó qua built-in tool `Task` — tool này SDK đã ship sẵn; bạn chỉ cần khai `"Task"` trong `allowedTools` (danh sách tool Claude được phép dùng). Cách gọi chắc ăn nhất là đặt tên subagent thẳng trong prompt.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk"

process.env.CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oat-..."

const session = query({
  prompt: "Use the warchief agent to implement task A",   // đặt tên thẳng trong prompt
  options: {
    // allowedTools: danh sách built-in tool Claude được phép dùng.
    // "Task" là tool để spawn subagent — BẮT BUỘC nếu có khai báo agents.
    allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "Task"],
    agents: {
      // Key = tên subagent mà model dùng trong lời gọi Task tool.
      warchief: {
        description: "Delivery lead. Dùng để triển khai một task end-to-end.",
        prompt: "Bạn là warchief. Triển khai task được giao hoàn toàn: viết code, chạy test, báo cáo thay đổi.",
        tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],  // tool subagent được dùng
        model: "sonnet",   // có thể khác model của main agent
      },
    },
  },
})

for await (const message of session) {
  if (message.type === "result") {
    console.log("Kết quả cuối:", message.result)
  }
}
```

Mấy điểm cần nhớ:

- **Field `agents`**: map tên (ở đây `"warchief"`) vô một `AgentDefinition` — `{ description, prompt, tools, model }`. Field `description` là thứ main model đọc để quyết định khi nào gọi subagent này.
- **`Task` trong `allowedTools`**: thiếu cái này, model không gọi được built-in `Task` tool, subagent khai báo xong cũng vô nghĩa.
- **Explicit invocation (gọi tường minh)**: viết "Use the warchief agent to..." trong prompt giúp main model biết chính xác cần delegate cho ai, không phải đoán.
- **Nhận output**: `for await` qua `Query` object, check `message.type === "result"` là câu trả lời cuối.

## 4. Viết tool của riêng mình — in-process MCP server

Đây là phần tui thấy thú nhất.

**MCP (Model Context Protocol — giao thức ngữ cảnh mô hình)** là giao thức mở Claude dùng để gọi external tool. Bình thường một MCP server là một process riêng, có port, phải spawn và quản lý. SDK cung cấp shortcut: `createSdkMcpServer()` + `tool()` đóng gói tool của bạn thành **in-process MCP server** — chạy ngay trong process Node/Bun của mình, không cần spawn hay quản lý process nào thêm.

Hai helper bạn cần:

### `tool(name, description, zodShape, handler)`

Khai báo một tool. Tham số:
- `name` — định danh của tool, ví dụ `"add"`.
- `description` — mô tả bằng ngôn ngữ tự nhiên về tool làm gì; model đọc cái này để quyết định khi nào gọi.
- `zodShape` — Zod schema **shape** (object truyền vô `z.object(…).shape`, không phải bản thân schema) mô tả input parameters của tool.
- `handler` — async function `(input) => Promise<ToolResult>`. Shape trả về:
  - Thành công: `{ content: [{ type: "text", text: string }] }`
  - Lỗi: `{ isError: true, content: [{ type: "text", text: string }] }`

### `createSdkMcpServer({ name, tools })`

Đóng gói một hoặc nhiều khai báo `tool()` thành một MCP server có tên. `name` này trở thành một phần của địa chỉ tool — xem quy tắc đặt tên bên dưới.

### Ví dụ chạy được ngay

```typescript
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

// Bước 1: khai báo tool với tên, mô tả, Zod schema, và handler
const myServer = createSdkMcpServer({
  name: "mytools",    // serverName — xuất hiện trong địa chỉ tool
  tools: [
    tool(
      "add",                                    // toolName
      "Cộng hai số và trả về tổng.",            // mô tả cho model
      { a: z.number(), b: z.number() },         // Zod shape (KHÔNG phải z.object(…), chỉ là shape)
      async (input) => ({
        content: [{ type: "text", text: String(input.a + input.b) }],
      }),
    ),
  ],
})

// Bước 2: gắn vào query qua mcpServers, cho phép trong allowedTools
for await (const m of query({
  prompt: "2 + 3 bằng bao nhiêu? Dùng tool add.",
  options: {
    mcpServers: { mytools: myServer },         // key = serverName
    allowedTools: ["mcp__mytools__add"],       // địa chỉ = mcp__<serverName>__<toolName>
  },
})) {
  if (m.type === "result") console.log(m.result)
}
```

**Quy tắc đặt tên (quan trọng):** mọi in-process MCP tool đều được gọi bằng địa chỉ `mcp__<serverName>__<toolName>`. Trong ví dụ trên: server `"mytools"`, tool `"add"` → địa chỉ `"mcp__mytools__add"`. Địa chỉ đầy đủ này phải có trong `allowedTools` thì model mới được phép gọi.

Khi tool gặp lỗi và muốn model thấy đó là tool error (không phải process crash), dùng variant lỗi:

```typescript
async (input) => ({
  isError: true,
  content: [{ type: "text", text: "Có lỗi xảy ra: " + reason }],
})
```

## 5. Mô hình tư duy — tóm một đoạn

Bốn khái niệm cốt lõi:

- **`query()`** = engine: gọi với prompt + options, iterate stream để nhận kết quả.
- **Env var** = auth: `CLAUDE_CODE_OAUTH_TOKEN` cho subscription, `ANTHROPIC_API_KEY` cho API; không có hàm login.
- **`options.agents` + `Task`** = subagent: khai báo agent dưới `agents`, model gọi qua built-in `Task` tool, `"Task"` phải có trong `allowedTools`.
- **`tool()` + `createSdkMcpServer()` + `options.mcpServers`** = custom tool: tạo in-process MCP server, model gọi theo địa chỉ `mcp__<serverName>__<toolName>`, phải có địa chỉ đó trong `allowedTools`.

Bốn cái đó là đủ để chạy flow đầu tiên. Mấy thứ phức tạp hơn (multi-turn queue, keep-alive session, channel delivery) thì để dành khi cần.
