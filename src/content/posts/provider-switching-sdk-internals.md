---
title: "Provider Switching & SDK-Mode Internals: How an Agent Harness Wires Claude's query() In-Process"
description: "Most agent harnesses hide more complexity than their README admits. This deep-dive traces a single chat message from WebSocket to token pool — covering in-process SDK calls vs. subprocess spawning, the HarnessEvent seam that makes providers swappable, and the OAuth token rotation that survives rate-limits and 401s."
pubDatetime: 2026-07-16T09:00:00Z
lang: en
tags:
  - claude-code
  - claude-agent-sdk
  - ai-agents
  - architecture
  - oauth
  - provider-abstraction
multiLangKey: "provider-switching-sdk-internals"
---

Most agent harness READMEs promise "multi-provider support" and leave you to guess how it actually works. Is the model called in-process? Spawned as a subprocess? How does switching providers not break every downstream consumer? And when you pool several OAuth accounts for burst capacity, what stops a single rate-limited token from silently poisoning a whole conversation?

This post traces one chat message — from the WebSocket receive all the way down to the token pool — through a real agent harness built on Claude's Agent SDK and Codex. The code paths below are real; internal paths and system names have been genericised.

## TL;DR

1. **The harness does not shell out `claude -p`.** In SDK mode it imports `query` from `@anthropic-ai/claude-agent-sdk` and calls it directly inside the server process. `query()` returns an async generator; the harness consumes it with `for await`. No subprocess, no stdout pipe — from the harness's perspective it is just an async iterator.

2. **"Switching providers" means choosing a driver and normalising output.** Three providers (`claude`, `codex`, `openrouter`) map to two drivers. A single predicate `isClaudeSdkProvider()` decides the fork: `claude` and `openrouter` share the SDK driver; `codex` gets its own subprocess driver. Both drivers produce the same `HarnessTurn` object with a `stream: AsyncIterable<HarnessEvent>` — that's the seam that makes the rest of the system provider-agnostic.

3. **Codex is the actual subprocess.** The Codex driver spawns `codex app-server` and speaks JSON-RPC over stdio. This is the exact opposite of the SDK path — same output type (`HarnessEvent`), different machinery.

4. **Token pool: per-chat sticky leases, load-spread + LRU.** Each turn borrows one token from a pool of OAuth accounts. The pool picks by fewest concurrent owners first, then least-recently-used. The chosen token is injected into the SDK env as `CLAUDE_CODE_OAUTH_TOKEN`. On a 401 or rate-limit, the pool marks the token degraded, picks the next eligible one, and replays the turn — with a deduplication window so multiple chats sharing the same token don't all trigger rotation at once.

---

## 1. The request path — from Enter to the model

Five hops stand between "user presses Enter" and "SDK is running":

```
Browser
  │  (WebSocket: chat.send)
  ▼
ws-router.ts          receives message, calls AgentCoordinator.send()
  ▼
AgentCoordinator.send()
  │  validates, opens/creates chat, optionally inserts a /compact turn
  ▼
AgentCoordinator.startTurnForChat()
  │  sets provider + model, creates HarnessTurn object
  │
  ├─ isClaudeSdkProvider(provider) === true  ──► startClaudeTurn()
  │                                                    │
  │                                                    ▼
  │                                            startClaudeSession()
  │                                            └─ query({ prompt, options })  ← SDK call
  │
  └─ provider === "codex"  ──► codexManager.startSession() + startTurn()
                                    │
                                    ▼
                             spawn("codex", ["app-server"])
                             └─ JSON-RPC over stdio
```

Both branches resolve to a `HarnessTurn`, whose `.stream` is an `AsyncIterable<HarnessEvent>`. The consumer loop — `runClaudeSession()` — iterates that stream and doesn't need to know which branch produced it.

---

## 2. Provider switching: three providers, two drivers, one interface

### 2.1 Provider catalogue

Each provider declares a `defaultModel`, a model list, and optional aliases. A `normalizeProviderModelId` function resolves an arbitrary model string to a canonical `(provider, modelId)` pair by matching against declared ids and aliases, falling back to the provider's default.

The provider type is simply:

```ts
export type AgentProvider = "claude" | "codex" | "openrouter";
```

### 2.2 The driver fork

The fork happens in `startTurnForChat()`:

```ts
let turn: HarnessTurn
if (isClaudeSdkProvider(args.provider)) {
  turn = await this.startClaudeTurn({ ... })         // claude + openrouter
} else {
  const sessionToken = await this.codexManager.startSession({ ... })
  turn = await this.codexManager.startTurn({ ... })  // codex
}
```

`isClaudeSdkProvider` is deliberately simple:

```ts
export function isClaudeSdkProvider(provider: AgentProvider): boolean {
  return provider === "claude" || provider === "openrouter";
}
```

`openrouter` goes through the same SDK path as `claude` because it exposes an Anthropic-compatible endpoint — only the env vars differ (base URL + auth token instead of OAuth token).

### 2.3 The normalisation seam: `HarnessTurn` and `HarnessEvent`

This is what makes providers genuinely substitutable:

```ts
export interface HarnessEvent {
  type: "transcript" | "session_token" | "rate_limit";
  entry?: TranscriptEntry; // normalised transcript line
  sessionToken?: string; // opaque session resume handle
  rateLimit?: { resetAt: number; tz: string };
}

export interface HarnessTurn {
  provider: AgentProvider;
  stream: AsyncIterable<HarnessEvent>; // ← the universal seam
  getAccountInfo?: () => Promise<AccountInfo | null>;
  interrupt: () => Promise<void>;
  close: () => void;
}
```

Everything above this interface — WebSocket routing, transcript storage, real-time UI push — is provider-blind. Everything below it is provider-specific.

---

## 3. SDK mode: `query()` in-process, not `claude -p`

### 3.1 What "in-process" means

The harness imports `query` from `@anthropic-ai/claude-agent-sdk` at the top of the server file and calls it as a normal async function:

```ts
const q = query({
  prompt: promptQueue,           // AsyncMessageQueue<SDKUserMessage>
  options: {
    cwd: args.localPath,
    model: args.model,
    effort: toSdkEffort(args.effort),
    resume: args.sessionToken ?? undefined,   // resume an existing session
    forkSession: args.forkSession,
    permissionMode: args.planMode ? "plan" : "acceptEdits",
    canUseTool,                               // tool approval hook
    mcpServers: { ... },
    systemPrompt: { type: "preset", preset: "claude_code", append: ... },
    env: buildClaudeEnv(process.env, args.oauthToken, ...),
  },
})
```

`q` is typed as `Query` — an `AsyncIterable`. The harness consumes it with `for await (const m of q)`. There is no `child_process.spawn("claude", ["-p", ...])` at the harness level. The SDK itself may manage a subprocess internally (that's opaque to the harness), but all the harness sees is an async generator it can iterate.

The `promptQueue` is an `AsyncMessageQueue<SDKUserMessage>`. The first turn pushes the prompt and (unless keep-alive mode is on) closes the queue. Subsequent turns push into the same queue — this is the SDK's native streaming-input mechanism for multi-turn conversations.

### 3.2 How SDK output becomes `HarnessEvent`

Two thin adapters sit between the raw SDK output and the harness stream:

**`toClaudeMessageStream(q)`** — filters SDK output to only Claude-directed messages:

```ts
async function* toClaudeMessageStream(q: Query) {
  for await (const m of q) {
    if (isSdkToClaudeMessage(m)) yield m;
  }
}
```

**`createClaudeHarnessStream(...)`** — maps each filtered message to a `HarnessEvent`:

- Message carries a `session_id` → `{ type: "session_token", sessionToken }`
- `type === "rate_limit_event"` → `{ type: "rate_limit", ... }`
- `type === "assistant"` and other content types → normalised `TranscriptEntry` → `{ type: "transcript", entry }`

The result is the `.stream` property of the returned `ClaudeSessionHandle`, which becomes `HarnessTurn.stream`.

### 3.3 Session continuity: why turn 2 remembers turn 1

The SDK emits a `session_id` on each message. The harness captures it:

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

The next turn reads it back and passes it to `query()` via `resume:`. The SDK uses that handle to continue the existing conversation rather than starting fresh.

Clearing `sessionToken` is therefore the mechanism behind any "start a new context" operation: the next turn becomes a fresh Claude session with no prior conversation history.

### 3.4 The Codex path for contrast

```
codexManager.startTurn()
  └─ spawn("codex", ["app-server"], { stdio: ["pipe","pipe","pipe"] })
       │
       ▼  (JSON-RPC lines over stdio)
  CodexAppServerManager
       │  parses notifications: turn/started, item/completed, ...
       ▼
  maps each notification → HarnessEvent
       ▼
  same HarnessTurn.stream interface
```

|                   | Claude (SDK mode)                                 | Codex                                            |
| ----------------- | ------------------------------------------------- | ------------------------------------------------ |
| Mechanism         | `query()` in-process, async generator             | `spawn("codex", ["app-server"])`, JSON-RPC stdio |
| Session resume    | `resume: sessionToken` field in `query()` options | `thread/resume` JSON-RPC message                 |
| Native event type | `SDKMessage`                                      | `turn/started`, `item/completed`, …              |
| Normalised to     | `createClaudeHarnessStream` → `HarnessEvent`      | `CodexAppServerManager` → `HarnessEvent`         |

---

## 4. Token pool: multiple OAuth accounts, per-turn rotation

### 4.1 Why OAuth tokens, not API keys

OAuth tokens carry subscriber identity. Usage billed through OAuth falls under the account's subscription plan; usage through a raw API key is billed at pay-per-token API rates. The harness is OAuth-only for this reason.

`buildClaudeEnv` enforces this by stripping any inherited `CLAUDE_CODE_OAUTH_TOKEN` from the parent process environment, then injecting the token the pool selected:

```ts
export function buildClaudeEnv(baseEnv, oauthToken, openrouter?) {
  const { CLAUDECODE: _u, CLAUDE_CODE_OAUTH_TOKEN: _o, ...rest } = baseEnv; // strip inherited
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
  return { ...rest, CLAUDE_CODE_OAUTH_TOKEN: oauthToken }; // ← pool-selected token
}
```

This env object is passed directly into `query()` options. The SDK reads `CLAUDE_CODE_OAUTH_TOKEN` from there — the token never escapes the turn's execution context.

### 4.2 Token entry structure

Each account in the pool is represented as:

```ts
interface OAuthTokenEntry {
  id: string;
  label: string; // human-readable account name
  token: string; // the actual OAuth bearer value
  status: "active" | "limited" | "error" | "disabled";
  limitedUntil: number | null; // epoch ms when rate-limit lifts
  lastUsedAt: number | null; // for LRU selection
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  addedAt: number;
  maxConcurrent?: number; // per-token concurrency ceiling (1–5)
}
```

Tokens are persisted in the harness settings file. The in-memory pool tracks which chat IDs currently hold a lease on each token (`tokenId → Set<chatId>`), but that ownership map is not persisted — it resets on process restart.

### 4.3 How `pickActive` selects a token

The selection algorithm is load-spread + LRU + sticky-lease, not pure round-robin:

1. **Sticky re-entry.** If this `chatId` already holds a valid token, return it immediately. This prevents a single chat from bouncing between tokens across multiple `pickActive` calls in the same turn.

2. **Eligibility filter.** Exclude tokens with status `error` or `disabled`; exclude tokens at or above their `maxConcurrent` ceiling; exclude `limited` tokens whose `limitedUntil` is still in the future.

3. **Ranking.** Among eligible tokens, prefer the one with the fewest current owners (load spread). Break ties by `lastUsedAt` ascending (least recently used first).

4. **Lease grant.** Add `chatId` to the token's owner set. A chat holds at most one token at a time.

The effect: tokens are not cycled uniformly — they're spread to balance load, then held stable for a chat to preserve prompt-cache locality and respect per-account concurrency limits.

If the pool exists but has no eligible token at call time, the harness throws an explicit error rather than silently falling back to whatever credential is in the ambient environment.

### 4.4 Rotation on failure

**Rate-limit** — detected two ways: the SDK emits a `rate_limit_event` message, or a text scanner finds a rate-limit pattern in the result text. Response: `pool.markLimited(id, resetAt)` → `pool.pickActive(chatId)` selects the next token → old session is torn down (reservation on new token held) → turn is scheduled for retry with `source: "token_rotation"`.

**401 authentication error** — detected by pattern-matching result text and debug output against known error strings (`api_error_status.*401`, `401 Invalid authentication credentials`, `"type":"authentication_error"`). Response: `pool.markError(id, reason)` (releases all reservations) → `pool.pickActive(chatId)` → immediate retry (no wait window, unlike rate-limit which waits for `limitedUntil`).

A deduplication window (`TOKEN_ROTATION_DEDUPE_WINDOW_MS`) and a rotation slot lock prevent multiple chats sharing the same degraded token from each triggering the same rotation simultaneously.

---

## 5. The full turn lifecycle in SDK mode

```
1. Browser sends chat.send over WebSocket
2. ws-router passes it to AgentCoordinator.send()
3. AgentCoordinator.startTurnForChat() — sets provider, creates HarnessTurn
4. isClaudeSdkProvider() forks to startClaudeTurn()
5. pool.pickActive(chatId) — lease one OAuth token (load-spread + LRU)
6. startClaudeSession():
     env = buildClaudeEnv(process.env, token)   ← injects CLAUDE_CODE_OAUTH_TOKEN
     q   = query({ prompt: queue, options: { env, resume: sessionToken, model, ... } })
                                                 ← in-process, NOT claude -p
7. stream = createClaudeHarnessStream(toClaudeMessageStream(q))
                                     ← SDKMessage → HarnessEvent
8. runClaudeSession(): for await (event of stream)
     - session_token event → persist, use as resume on next turn
     - rate_limit / 401   → markLimited/markError → pickActive → retry
     - transcript event   → persist to store, push to UI over WebSocket
9. Stream exhausted → turn complete; token lease stays for the next turn
```

---

## 6. Design takeaways

**The seam is the design.** `HarnessTurn` with `stream: AsyncIterable<HarnessEvent>` is the only interface the rest of the system touches. Adding a fourth provider means implementing that interface — nothing upstream needs to change.

**In-process vs subprocess is a driver-level decision.** Claude's SDK is in-process by nature; Codex requires a subprocess. The harness doesn't choose — the provider's driver chooses, and it hides the choice behind `HarnessTurn`.

**OAuth-only billing is an architectural constraint, not a configuration.** `buildClaudeEnv` strips any ambient API key before injecting the pool token. There is no "fall through to API key" path for pool-managed turns — the harness either has a valid OAuth token or it throws.

**Sticky leases preserve prompt-cache hit rates.** Letting a chat hold the same token across turns is not just a convenience — it means the provider's KV cache for that conversation is more likely to be warm on successive turns, reducing both latency and cost.

**Rotation on failure is explicit, not ambient.** Without the pool's `markLimited`/`markError` → retry cycle, a single degraded token could silently block a chat, or worse, the harness could fall back to a credential it was never supposed to use. Making the failure mode loud and the rotation intentional is what makes multi-account pooling operationally safe.
