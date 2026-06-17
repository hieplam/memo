---
title: "Inside a Claude Code Transcript: How Turns, Tokens, and Actors Actually Work"
description: "A hands-on deep dive built by reading a real Claude Code .jsonl session transcript line by line — what a transcript is, the three actors (user, model, harness), what a token really is, and exactly how a turn is calculated. Every claim tagged file-verified, docs-verified, or inference."
pubDatetime: 2026-06-17T00:00:00Z
lang: en
tags:
  - claude-code
  - transcripts
  - tokens
  - llm
  - ai-agents
---

> A hands-on deep dive built by reading a **real** Claude Code `.jsonl` session
> transcript line by line. Every claim below is tagged with its evidence level:
> 🟢 **file-verified** (observed directly in the transcript), ✅ **docs-verified**
> (confirmed against official Anthropic docs), or 🟡 **inference** (reasoned from
> data — Claude Code is closed-source, so some internals can only be deduced).
>
> All personal data (usernames, emails, absolute paths) has been redacted. UUIDs
> and request IDs shown are random identifiers, not PII.

---

## TL;DR

- A Claude Code session is an **append-only JSONL log** — one JSON object per line, chained via `uuid` → `parentUuid`. ✅
- There are **three actors**, and *most lines are not written by the model*: 🧑 **User**, 🤖 **Model**, ⚙️ **Harness** (Claude Code itself). 🟢
- A **token** is a sub-word chunk, not a word. The transcript stores token **counts** (`message.usage`), never the tokens themselves. ✅
- A **turn** is one *prompt-processing lifecycle*: it opens when you submit a prompt and closes when the agent loop stops (the model returns with no more tool calls). **One turn can contain many API round-trips.** 🟢🟡
- The end of a turn is marked by a single line: `type: "system"`, `subtype: "turn_duration"`, carrying `durationMs`. This field is **not officially documented** — it was discovered by inspection. 🟡

---

## 1. What a transcript file is

Every Claude Code session is written to a `.jsonl` file (one under
`~/.claude/projects/<project>/<sessionId>.jsonl`). **JSONL** = JSON Lines: each
line is a complete, self-contained JSON object, appended as the session
progresses. ✅

The core fields on each line:

| Field | Meaning |
|---|---|
| `type` | Event discriminator: `user`, `assistant`, `system`, `attachment`, … |
| `uuid` | Unique ID of this line |
| `parentUuid` | Points back to the previous line — forms the conversation chain/tree |
| `timestamp` | UTC, ISO 8601 |
| `message` | The payload — has `role`, `content`, and `usage` for user/assistant lines |
| `requestId` | Present on `assistant` lines — identifies **one API call** |
| `sessionId`, `cwd`, `gitBranch`, `version` | Session metadata |

Inside `message.content` are **content blocks**: `text`, `thinking`,
`tool_use` (with `name`, `input`), and `tool_result` (referencing a
`tool_use_id`). ✅

> 🟡 **Inference — one message, split across lines.** Claude Code writes *each
> content block as its own transcript line*. Proof: two consecutive `assistant`
> lines shared the **same `requestId` and the same `msg.id`**, yet one held a
> `thinking` block and the other a `text` block, with timestamps **1 ms** apart.
> They are a single API response split in two — not two replies.

---

## 2. The three actors in a flow

Reading the transcript reveals that a single "turn" is a collaboration between
three actors — and **many lines are bookkeeping, not model output**:

| Actor | `type` it produces | Calls the API? | Role |
|---|---|:---:|---|
| 🧑 **User** | `user` (role=user, text content) | ❌ | Submits the prompt that opens a turn |
| 🤖 **Model** | `assistant` (has `requestId`) | ✅ | Thinks, replies, requests tools |
| ⚙️ **Harness** (Claude Code) | `attachment`, `system`, **`tool_result`** | ❌ | Injects context, runs tools, times the turn |

### The big trap: `tool_result` looks like a user

A `tool_result` line carries `type: "user"`, `role: "user"` — **even though the
harness produced it, not the human.** 🟢 In one sampled turn, of six `user`-role
lines, **five were tool results** and only **one** was the real prompt. If you
split turns by `role == "user"` alone, you will pick the wrong start.

### Harness "stage-setting" lines at the top of a turn 🟢

Right after your prompt, before the model runs, the harness injects:

- `attachment / deferred_tools_delta` — declares which deferred tools are available
- `attachment / mcp_instructions_delta` — loads MCP server usage instructions
- `attachment / opened_file_in_ide` — notes a file you have open in the editor

These share the prompt's timestamp (written in ~0 ms) and do **no** model work.

---

## 3. What a token is

A **token** is the smallest chunk of text the model processes — usually a
*sub-word*, not a whole word. Modern LLMs (including Claude) use Byte-Pair
Encoding or a proprietary variant. ✅

**Real tokenizer output** (illustrative `cl100k_base` encoder): 🟢

```
"My Name Is Todd"  →  ['My', ' Name', ' Is', ' Todd']   = 4 tokens
"jq is great"      →  ['j', 'q', ' is', ' great']        = 3 words → 4 tokens
```

Notes you can see directly:
- The leading space is glued to the *front* of a token (`' Name'`, `' Is'`).
- A word can split: `command-line` → `' command'` + `'-line'`.
- Accented languages (e.g. Vietnamese) usually cost **more** tokens per word.

### Token counts live in `message.usage` (assistant lines only) ✅

| Field | Real example | Meaning |
|---|---:|---|
| `input_tokens` | 65 | **New** input tokens, not served from cache |
| `cache_read_input_tokens` | 46,086 | Tokens replayed from cache (~10% of the price) |
| `cache_creation_input_tokens` | 850 | Tokens written *into* the cache this call |
| `output_tokens` | 566 | Tokens the model generated |

> 🟢 A small `input_tokens` (65) does **not** mean the model read little — it
> processed ~47,000 tokens, but ~46,000 came from cache. Deep into a session,
> almost everything is a cache hit, so `input_tokens` shrinks to single digits.

> ⚠️ The transcript stores **counts only — never the token list**. To see *which
> word maps to which token*, you must **re-tokenize** (run the text back through
> a tokenizer). Claude's exact tokenizer is proprietary, so a local tokenizer is
> a faithful approximation, not the billed split. ✅

---

## 4. How a turn is calculated — the heart of it

### 4.1 Definition

> **A turn = one prompt-processing lifecycle.** It opens when the user submits a
> prompt and closes when the agent loop stops — i.e. the model returns a response
> with **no more `tool_use` blocks** (`stop_reason: "end_turn"`). ✅ (loop
> mechanics) + 🟡 (mapping the loop onto a "turn").

The agent loop, confirmed by Anthropic docs: while the model returns
`stop_reason: "tool_use"`, the harness runs the tool, feeds the result back, and
calls the model again — repeating until the stop reason is no longer `tool_use`. ✅

### 4.2 The anchor field

**The end of a turn is a single line:** `type: "system"`,
`subtype: "turn_duration"`. It carries:

- `durationMs` — the turn's length in milliseconds
- `messageCount` — cumulative message count at that point (does **not** reset per turn) 🟢

> 🟡 **`turn_duration` is not in the official docs.** Community write-ups of the
> JSONL format describe `user`/`assistant`/`system` and the usage fields, but
> none mention `turn_duration`. This section is original observation from the raw
> file.

### 4.3 A turn is NOT one API call 🟢

The strongest evidence: one long turn contained **four distinct `requestId`s**
(four model round-trips) but exactly **one** `turn_duration`:

```
prompt
  → API#1  (model asks for tools)   → [harness runs tools]
  → API#2  (model asks for tools)   → [harness runs tools]
  → API#3  (model asks for tools)   → [harness runs tools]
  → API#4  (end_turn — final answer)
turn_duration   ← durationMs = 54,084 ms,  messageCount = 33
```

So: `requestId` = one round-trip; `turn_duration` = one turn that *wraps* many
round-trips. The model even **self-corrected mid-turn** — a `WebFetch` hit a
redirect, and the model re-fetched the corrected URL on the next round-trip,
all inside the same turn.

### 4.4 How `durationMs` is measured (deduced from numbers)

🟢 file-verified data → 🟡 inferred mechanism:

| Turn | Timestamp gap (start→end) | `durationMs` | Difference |
|---|---:|---:|---:|
| Simple ("what is jq", 1 API call) | 13.548 s | 13.330 s | 0.218 s |
| Long (4 API calls) | 54.282 s | 54.084 s | 0.198 s |

The ~0.2 s gap is **stable across both short and long turns.** The deduction:
the `durationMs` clock starts ~0.2 s *after* the prompt's timestamp — it skips
the harness's initial hook execution and context assembly. And `turn_duration`
is written only **3–7 ms** after the final `assistant` line, meaning the turn
closes the instant the agent loop exits.

### 4.5 A concrete anchored example ("what is jq") 🟢

```
START   user prompt      ts = …:05.743   (uuid …aad6a25e)
END     turn_duration    ts = …:19.291   (uuid …2d7805ee)   durationMs = 13330
ELAPSED = 19.291 − 05.743 = 13.548 s   ≈   durationMs 13.330 s   ✓
```

This was the simplest case — no tools needed, so **1 turn = 1 round-trip**,
which is exactly why it's easy to confuse the two concepts.

---

## 5. How to find turn boundaries (the practical rule)

- 🔴 **Turn end (hard anchor):** the line where `subtype == "turn_duration"`.
  No guessing — Claude Code announces it, and `durationMs` is right there.
- 🟢 **Turn start:** the nearest *genuine* user prompt above it — a `user` line
  that is **not `isMeta`** and **not a `tool_result`** (remember: tool results
  also carry `role: "user"`).
- ⏱️ **Duration:** read `durationMs` directly, or compute
  `end.timestamp − start.timestamp` (which runs ~0.2 s longer because it
  includes the pre-timer hook/context phase).

---

## 6. Conclusions

1. **Transcript** = append-only JSONL; each line an event, chained by `uuid` → `parentUuid`.
2. **Three actors:** User (prompt), Model (assistant + `requestId`), Harness (attachment/system/tool_result). Many lines are harness bookkeeping, not model output.
3. **Token** = sub-word unit; the transcript stores *counts*, not tokens — re-tokenize to see the actual split.
4. **Turn** = one prompt lifecycle: opens at the prompt, closes at `turn_duration` once the model stops calling tools. **A turn can span many API calls.**
5. **Timing:** use `durationMs`, or the timestamp delta (≈ 0.2 s longer).

---

### Verification sources

- Stop reasons & the tool-use loop — Anthropic API Docs: <https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons>
- Prompt caching & usage token fields — Anthropic API Docs: <https://platform.claude.com/docs/en/build-with-claude/prompt-caching>
- Tokenization / BPE primer: <https://stackviv.ai/blog/tokens-tokenization-llm-explained>
- Community JSONL format reference: <https://deepwiki.com/simonw/claude-code-transcripts/5.1-jsonl-format>

*Everything tagged 🟢 was observed directly in a real transcript; ✅ was
cross-checked against official docs; 🟡 is reasoned inference, clearly flagged
because the Claude Code internals are closed-source.*
