---
title: "Shrinking the Agent Loop, Part 1: How RTK and Caveman Attack Opposite Ends of the Pipe"
description: "RTK and Caveman both cut LLM token usage, but they attack opposite ends of the agent loop — one filters noisy command output before it reaches the model, the other makes the model itself talk less. A source-level tour of how each actually works, mechanism by mechanism."
pubDatetime: 2026-07-01T00:00:00Z
lang: en
tags:
  - llm-tooling
  - agent-loop
  - token-reduction
  - rust
  - cli-tools
multiLangKey: "rtk-vs-caveman-1"
---

> **"Shrinking the Agent Loop: RTK vs Caveman" — Part 1 of 3.** A source-level tour of how two
> token-reduction tools work — one filtering command output on the way in, the other making the
> model talk less on the way out. This series audits both tools from source, cross-checked
> against adversarially verified public research.

---

Two open-source tools set out to solve the same problem — an agent loop burning through its
token budget — by attacking it from opposite ends. **[rtk-ai/rtk](https://github.com/rtk-ai/rtk)**
("Rust Token Killer") is a single Rust binary that intercepts your shell commands and filters
their output before it ever reaches the model. **[JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)**
("why use many token when few do trick") takes the opposite approach: it coaches the model
itself into writing tersely, plus a small deterministic compressor on the way in. This post is a
source-level look at how each one actually works.

> **RTK shrinks what goes into the model (noisy command output). Caveman shrinks what comes out
> of the model (verbose prose), plus a little on the way in.** They attack different parts of the
> agent loop, so they're complementary — you can run both.

An agentic LLM loop spends tokens in three places: the **context it reads** (files, tool
schemas), the **tool results** piped back in, and the **response it writes**. RTK owns the
_tool-results_ pipe; Caveman owns the _response_ pipe and dabbles in the _context/schemas_ pipe.

## 1. RTK (`rtk-ai/rtk`) — "Rust Token Killer"

**What it is:** a single compiled **Rust binary** (no LLM, no network in the hot path, `<10ms`
overhead). ~100 supported commands. It's a transparent CLI proxy.

**End-to-end flow:**

1. **Transparent rewrite via a hook.** When your agent (Claude Code, Cursor, Copilot, Gemini,
   OpenCode… 9+ agents) is about to run `cargo test`, a `PreToolUse` hook fires. The hook is a
   _thin delegate_ — it reads the tool-call JSON and calls `rtk rewrite "cargo test"`.
2. **Registry match.** `src/discover/registry.rs` runs a compiled `RegexSet` over a static
   `RULES` table (70+ patterns) and returns `rtk cargo test`. The hook hands that back as
   `updatedInput`, so the agent silently runs the wrapped version. You never see this.
   - _Security:_ the rewriter **passes through unchanged** (refuses to rewrite) any command with
     `$(...)`, backticks, heredocs, or process-substitution — a quote-aware lexer.
3. **Run + capture.** The `rtk` binary spawns the _real_ `cargo test` as a child process and
   captures stdout/stderr (capped at 10 MiB, ANSI stripped, exit-code aware). `RunMode` enum:
   `Filtered` (capture whole then filter), `Streamed` (filter line-by-line for huge outputs),
   `Passthrough`.
4. **Per-tool deterministic filter.** The heart. Each tool has a **dedicated Rust parser**
   (`cargo_cmd.rs`, `pytest_cmd.rs`, `mvn_cmd.rs`, `gradlew_cmd.rs`, `tsc_cmd.rs`, `git/*.rs`,
   `aws_cmd.rs`, `golangci_cmd.rs`…). It _understands_ the format: keeps failures + error
   context + summary counts, drops passing tests, progress spinners, banners. Unknown commands
   fall back to a generic 8-stage TOML pipeline (`.rtk/filters.toml`: strip ANSI → regex sub →
   success short-circuit → strip/keep lines → truncate → head/tail → max_lines → on_empty) or
   pass through untouched.
5. **Compact result reaches context.** `cargo test` ≈ 25k tokens → RTK returns ≈ 2.5k
   (`"3 failed, 142 passed"` + the 3 failures).

**It's lossy-but-structured:** throws away the boring 90%, keeps the signal. **Savings:** 60–90%
on command output, measured per-command into a local SQLite DB (`~/.local/share/rtk/`) via a
`chars÷4` token estimate, surfaced by `rtk gain`.

## 2. Caveman (`JuliusBrussee/caveman`) — "why use many token when few do trick"

**What it is:** not a binary — a **multi-platform skill/plugin** (Node + Python + hooks) for
Claude Code, Codex, Gemini, Cursor, OpenCode… 30+ agents. It's **two mechanisms in a trenchcoat:**

### ① Behavioral mode (output side — the real win)

It injects a rule into the system context: _"Respond terse like smart caveman. All technical
substance stay. Only fluff die."_ — delivered via a `SessionStart` hook (loads `SKILL.md`) and
reinforced every turn via `UserPromptSubmit`. The **model itself** then writes shorter answers:

> "Sure! I'd be happy to help. The issue is likely your auth middleware…" (69 tok) →
> **"Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"** (19 tok)

- Intensity levels: `lite` / `full` / `ultra` / `wenyan` (Classical Chinese, ~80–90% reduction).
- **Auto-Clarity** safety valve: reverts to normal prose for security warnings, irreversible
  actions, or when you're confused; code & PRs always written normally.
- A `cavecrew` of sub-agents (investigator/builder/reviewer) running on Haiku.

### ② Deterministic compressor (input side)

Pure-Node/Python regex (`compress.js`), no model call:

- **`caveman-shrink`** — an MCP proxy that wraps an upstream MCP server and compresses the
  `description` fields in `tools/list` responses (trims bloated tool schemas).
- **`caveman-compress`** — a `/caveman-compress` command that rewrites files like `CLAUDE.md`
  on disk.
- Rules: drop articles (a/an/the), filler (just/really/basically), pleasantries, hedging.
  **Protected & never touched:** fenced/inline code, URLs, paths, identifiers, version numbers.

**Savings — read with skepticism:** marketplace says **~75%**; the live `/caveman-stats` applies
a _hardcoded_ `0.65` constant (only "full" mode is actually benchmarked); and Caveman's own
10-prompt eval vs an "Answer concisely." control shows **~50–53% with huge variance (−2% to
+87%)**. Because the win comes from the model _choosing_ to write less, it's not measurable
without a counterfactual — unlike RTK, which sees exactly what it discarded.

## 3. Point-by-point differences

|                  | **RTK**                                | **Caveman**                                                    |
| ---------------- | -------------------------------------- | -------------------------------------------------------------- |
| Reduces          | **INPUT** tokens (tool/command output) | **OUTPUT** tokens (model's prose) + some input (schemas/files) |
| Mechanism        | Deterministic per-tool Rust parsers    | ① LLM behavior change (prompt) · ② regex                       |
| LLM in the loop? | **No**                                 | ① **Yes** (the model itself) · ② No                            |
| Runtime          | One Rust binary, `<10ms`, offline      | Node+Python hooks, MCP proxy                                   |
| Lossy?           | Lossy but structured                   | ① lossy summarization · ② near-lossless                        |
| Coverage         | ~100 _known_ tools (else fallback)     | Any prose, any task (generic)                                  |
| Savings basis    | Measured raw-vs-filtered (`rtk gain`)  | Mostly estimated/behavioral                                    |
| Best for         | Build/test/git/cloud-heavy sessions    | Explanation-heavy chat; bloated schemas/CLAUDE.md              |

## 4. They're complementary, not competitors

RTK cuts what the agent _reads from tools_; Caveman cuts what the agent _writes_ (and the
schemas/files it reads). Run both and they stack — with the only seam being MCP/CLAUDE.md
compression, and even there they target different content.

> **Key idea:** two different chokepoints, one shared goal. RTK is a deterministic filter on
> the input pipe; Caveman is a behavioral nudge on the output pipe plus a small regex on the
> side. Neither replaces the other.

The next post turns to the question that matters once you've decided to run either of these
inside your agent loop: what does it mean for your security posture to hand a hook this much
trust?

---

### Sources

Source-level read of both repositories — [rtk-ai/rtk](https://github.com/rtk-ai/rtk) (Rust) and
[JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Node + Python). Benchmark
figures are vendor-reported.

---

**Next:** [Part 2 — Living Inside the Trust Boundary](/memo/posts/rtk-vs-caveman-part-2-security/) →

**The series — Shrinking the Agent Loop: RTK vs Caveman:** **1 · How They Work (you are here)** ·
[2 · Living Inside the Trust Boundary](/memo/posts/rtk-vs-caveman-part-2-security/) ·
[3 · A NUL Sentinel, a ReDoS, and a Secret Left in Plaintext](/memo/posts/rtk-vs-caveman-part-3-shrink-deep-dive/)
