---
title: "Shrinking the Agent Loop, Part 2: Living Inside the Trust Boundary"
description: "Both tools run as hooks inside the agent's trust boundary — unsandboxed, with your full privileges, feeding the model unsanitised. A full security review of RTK and Caveman, from command-rewrite safety to supply-chain integrity, ranked risk class by risk class."
pubDatetime: 2026-07-01T00:00:00Z
lang: en
tags:
  - security
  - agent-loop
  - supply-chain
  - mcp
  - threat-modeling
multiLangKey: "rtk-vs-caveman-2"
---

> **"Shrinking the Agent Loop: RTK vs Caveman" — Part 2 of 3.** A full security review of both
> tools as agent-loop interceptors — where the danger is structural, where it's tool-specific,
> and what to actually do about it. Part of a series auditing rtk-ai/rtk and JuliusBrussee/caveman
> from source.

- **TL;DR**
  - Neither tool, as currently written, has an obvious RCE/exfil backdoor, and both show
    above-average defensive engineering.
  - The real, high risk is structural and shared: both run as unsandboxed hooks inside the
    agent's trust boundary, with your full privileges, feeding the model unsanitised.
  - Manage this as a **supply-chain integrity** problem — a compromised future version means
    full agent compromise — not a today's-code problem.
  - Of the two, Caveman carries more residual supply-chain risk (an unpinned
    `curl|bash → npx github:` bootstrap); RTK is tighter (single checksummed binary, fail-closed
    install).

---

This review treats both tools as _interceptors inside the agent's trust boundary_. It separates
the **inherent** architectural exposure — shared by both, severe if abused — from the
**tool-specific** findings, which are mostly low–medium. Severity is attacker-model-scoped and
reflects a point-in-time read of public source; a future version can change every rating.
(rtk-ai/rtk @ master (Rust) · JuliusBrussee/caveman @ main / v1.9.0 (Node+Python).)

## 1. The headline

Neither tool, **as currently written**, contains an obvious remote-code-execution or
data-exfiltration backdoor — and both show genuine, above-average defensive engineering (RTK's
quote-aware command lexer + fail-closed checksums; Caveman's `O_NOFOLLOW` symlink-hardened flag
files + pinned, SHA-256-verified hooks).

**The real, high risk is structural and identical for both:** a hook/skill runs with your full
user privileges, with no sandbox, and anything it emits is injected into the model's context
unsanitised. So a **compromised future version** (malicious update, stolen maintainer token,
MITM during install) equals total agent compromise: it can read every secret the agent can read
and rewrite/inject every command. **The threat you must manage is supply-chain integrity, not
today's code.** Caveman is the higher supply-chain risk of the two.

## 2. Why interceptors are inherently dangerous

A Claude Code hook is not a sandboxed plugin — it is an OS process running as you, wired into
events that feed the model. Per Anthropic's own docs (adversarially verified):

- _"For UserPromptSubmit … and SessionStart hooks, anything you write to stdout is added to
  Claude's context."_
- `PreToolUse` can rewrite a tool's input via `updatedInput`.
- _"Any process running as the current user can write to `~/.claude/settings.json`. No OS
  protection, no signature check, no user confirmation… no persistent indicator that hooks are
  registered."_ (claude-code#49778)
- Real precedent: the **Cozempic** npm package wrote a global `SessionStart` hook + a
  `PostToolUse matcher:""` (sees every tool call) on install.

That is precisely the machinery RTK and Caveman use — and the same machinery an attacker would.

## 3. Risk-class severity matrix

| Risk class                                                                           | RTK                                | Caveman                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------- |
| **0 · Inherent trust-boundary exposure** (compromised build → full agent compromise) | 🟧 **HIGH** (structural, shared)   | 🟧 **HIGH** (structural, shared)              |
| **1 · Context / prompt injection** (hook stdout & additionalContext)                 | 🟩 LOW (rules-file text only)      | 🟨 **MEDIUM** (behavioural: can drop caveats) |
| **2 · Command-rewriting safety**                                                     | 🟩 LOW (quote-aware, fail-closed)  | — N/A (doesn't rewrite commands)              |
| **3 · Supply chain (install/update)**                                                | 🟨 MEDIUM (fail-closed checksum ✔) | 🟧 **HIGH** (unpinned bootstrap)              |
| **4 · MCP proxy / tool-poisoning**                                                   | — N/A                              | 🟨 LOW–MED (NUL-sentinel bug, PoC)            |
| **5 · Sensitive-data exposure / exfiltration**                                       | 🟨 LOW–MED (cmd args in SQLite)    | 🟨 MEDIUM (compress → file to LLM)            |
| **6 · Local file write · symlink · TOCTOU**                                          | 🟩 LOW (runtime integrity ✔)       | 🟩 LOW (O_NOFOLLOW hardened ✔)                |
| **7 · Code-eval in loaders**                                                         | ⬜ INFO (none)                     | 🟩 LOW (local-only eval)                      |

## 4. RTK — findings

### Command-rewrite injection — LOW

- **Well-defended.** The PreToolUse hook only _returns a rewritten string + exit code_ — it
  never executes the command (the agent does, under its own permissions).
- Quote-aware lexer rejects (passthrough) heredocs, `$(...)`, backticks, process-substitution;
  single-quoted metachars correctly ignored. `discover/lexer.rs:279–315`, `registry.rs:243,497`.
- Child spawned via `Command::new(prog).args()` (argv/exec, **not** `sh -c`); shell hook uses
  `jq --arg` (no injection).
- **Residual:** `rtk run` uses `sh -c` but only on a command the agent already chose; the hook
  never emits it. `main.rs:2322–2328`.

### Project filter (`.rtk/filters.toml`) context-injection — MEDIUM

- **Attacker:** a malicious repo ships a `.rtk/filters.toml`.
- **Mitigation (solid):** trust-gated — SHA-256-locked at `rtk trust` time, fail-closed if
  untrusted, content-change re-invalidates. The env bypass `RTK_TRUST_PROJECT_FILTERS=1` only
  works alongside CI vars an attacker can't set on your box. `toml_filter.rs:192–216`,
  `hooks/trust.rs:103–118`.
- **Gap:** _after_ a dev runs `rtk trust`, a filter's `match_output`/`on_empty`/`replace` can
  rewrite or fabricate the command output the LLM sees (hide build errors, inject "All tests
  passed."). `toml_filter.rs:453–476`.
- Real risk = social-engineering the `rtk trust` step. **Never trust a filters file you haven't
  read.**

### Supply chain (install / update) — MEDIUM

- **Binary install: fail-closed.** `install.sh` downloads `checksums.txt`, refuses to install
  on missing/mismatched SHA-256. `install.sh:104–128`.
- Bypass exists: `RTK_SKIP_CHECKSUM=1` silently skips verification.
- Hook scripts integrity-checked at runtime, fail-closed (`exit 1` on tamper); but legacy
  "no baseline" + the newer binary-hook model are no-ops. `hooks/integrity.rs`.
- **Weak spots:** Homebrew `Formula/rtk.rb` still has `PLACEHOLDER_SHA256_*` (unmaintained
  signal); `cargo install --git` bootstrap unpinned; checksums served from the same GitHub
  release (a repo compromise defeats it — same limit as most tools). `build.rs` is benign
  (local file reads only).

### Data exposure — telemetry & data-at-rest — LOW–MEDIUM

- **Telemetry: privacy-respecting.** Off by default, triple-gated
  (`RTK_TELEMETRY_DISABLED`, explicit consent, enabled flag); sends anonymous device hash +
  version/os/arch + aggregate counts + command _names_ only — **no args, no output, no file
  contents**; HTTPS once/day; GDPR contact listed. `telemetry.rs:29–46,109–115`,
  `docs/TELEMETRY.md`.
- **The real exposure:** the local SQLite DB persists the executed **command strings** + token
  counts (not output). Secret-bearing _arguments_ — `curl -H "Authorization: …"`, psql URIs,
  `AWS_SECRET=…` — would sit in **plaintext at rest**, unencrypted. `core/tracking.rs`. (Part 3
  of this series works through the full data-at-rest analysis.)
- Local-access risk (backups, stolen laptop, snooping process), not network exfil.

## 5. Caveman — findings

### Supply chain — unpinned bootstrap — HIGH

- **Attacker:** compromised maintainer / stolen token / MITM pushes to `main`; every new
  installer hits it.
- `curl|bash` → `exec npx -y "github:JuliusBrussee/caveman"` — **no ref/SHA pin**; runs whatever
  `bin/install.js` is on the mutable default branch, with your privileges. `install.sh:54`.
- Hook _files_ ARE pinned to `v1.9.0` + SHA-256 verified, fail-closed on mismatch (deletes +
  aborts) — **good**. `install.js:36,833–840`.
- **But fail-OPEN when the manifest is absent** ("downloaded hooks installed unverified" — warn
  only), and `CAVEMAN_REF=main` redirects to the unpinned branch through that same warn path.
  `install.js:843`.
- **Worse:** the `--with-init`/`--all` path downloads `caveman-init.js` and `spawnSync`s it with
  **no checksum at all** → RCE on MITM/compromised ref. `install.js:973–976`.

### Behavioural safety — "drop the caveats" — MEDIUM

- The injected skill tells the model: "Respond terse… **Only fluff die**. Drop… hedging."
  Terseness can **suppress security warnings or destructive-action caveats**.
  `src/rules/caveman-activate.md`.
- Mitigation: **Auto-Clarity** reverts to normal prose for "security warnings, irreversible
  actions, user confused." But it's **LLM-judgment, not a hard guarantee** — a missed judgement
  is a dropped warning.
- Not classic injection (it doesn't add malicious text) — but it can _remove_ safety-relevant
  text. Treat caveman-mode output as terse, not authoritative on risk.

### caveman-compress — file contents → LLM — MEDIUM

- Compression of memory/context files is done by **sending the file's contents to the model**
  and rewriting the file **in place** (backups out-of-tree).
- The "refuse `.env`/`.ssh`/`.aws`/source files" denylist is **prompt-enforced** (instructions
  in the skill `.md`), **not code-enforced** — it relies on model compliance.
  `plugins/opencode/commands/caveman-compress.md:13`.
- A `CLAUDE.md` or `config.json` with a pasted token isn't on the denylist → would be read,
  sent, rewritten. User-initiated, but review files before compressing/committing.

### caveman-shrink MCP proxy — NUL-sentinel bug — LOW–MEDIUM

- The proxy protects code/URLs/paths by swapping them for a **NUL-delimited index sentinel**
  `\0i\0`, then restores via `/\0(\d+)\0/g` — **in-band signalling**.
  `caveman-shrink/compress.js`.
- **Confirmed by PoC:** an upstream that injects NUL via JSON can forge sentinels → splice an
  in-description token or inject literal `"undefined"`, corrupting the tool description the
  model reads.
- **Honest scoping:** normal descriptions (no NUL) are untouched; and a malicious upstream
  _already_ has full tool-poisoning power, so this grants little _new_ capability. It's a
  robustness / in-band-delimiter flaw, not a privilege escalation. Only touches `description`
  on _list_ responses, never `tools/call` results. (Part 3 of this series walks through the
  full PoC.)

### Flag write/read — symlink & TOCTOU — LOW

- **Genuinely hardened** — and the threat is explicitly modelled in-code ("a local attacker
  could point the flag at `~/.ssh/id_rsa`… readers would slurp that into model context").
- `safeWriteFlag`: symlink-dir uid-ownership check; refuses symlink at target; temp file with
  `O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW` mode `0600`; atomic rename. `readFlag`: refuse symlink,
  64-byte cap, `O_NOFOLLOW`, `VALID_MODES` whitelist. `hooks/caveman-config.js:132–241`.
- Residual TOCTOU window is tiny and needs a **local** attacker (who already has bigger options).

### Code-eval & install spawn — LOW

- `new Function(...)` evals an on-disk `caveman-config.cjs` in the opencode plugin — but the
  file is install-written and not re-fetched; exploit needs prior local write access.
  Architectural smell, not a remote vector. `plugins/opencode/plugin.js:65`.
- **Cross-checked / corrected:** installer `spawnSync(…,{shell:true})` looked risky, but `cmd`
  is always a hardcoded provider name and args go through correct
  `shellEscape`/`quoteWinArg` → **not injectable**. `install.js:268,405`.
- **Telemetry: none** — no phone-home found anywhere. **Clean.**

## 6. External threat landscape

These published facts establish that the interceptor risk class is real and actively exploited —
the backing for risk-class 0 and 3. (A fabricated _"Shai-Hulud May 2026"_ claim that surfaced in
search was **refuted and dropped**.)

- Hooks: stdout from UserPromptSubmit/SessionStart is injected into context unsanitised; anyone
  who can write `~/.claude/settings.json` registers hooks silently (Anthropic docs;
  claude-code#49778; Cozempic precedent).
- MCP: Anthropic _does not_ security-audit MCP servers (caveman-shrink is unvetted); tool
  descriptions can carry hidden instructions and change after approval; PoC leaked SSH keys via
  a poisoned description (Anthropic security docs; OWASP MCP Top-10 MCP03; Invariant Labs).
- Real Claude Code supply-chain CVE chain: one GitHub issue → read `/proc/self/environ` →
  exfiltrate secrets (flatt.tech; Check Point CVE-2025-59536).

**Primary sources:** docs.anthropic.com/claude-code/hooks · github.com/anthropics/claude-code/issues/49778
· docs.anthropic.com/claude-code/security · owasp.org/www-project-mcp-top-10 (MCP03) ·
invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks · flatt.tech
(poisoning-claude-code) · research.checkpoint.com (CVE-2025-59536).

## 7. Verdict & hardening checklist

**If you must rank them:** **Caveman carries more residual risk** (bigger surface: Node + 30+
integrations + MCP proxy + on-disk rewrites; unpinned bootstrap; a no-checksum install path;
behaviour that can suppress safety text). **RTK is tighter** (single checksummed binary,
deterministic, no LLM/network in the hot path, fail-closed install; sharpest edges are the
`rtk trust` social-engineering vector and command args at rest in SQLite). **Both** are only as
safe as their next update.

**Do these regardless of which you run:**

1. **Pin everything.** Install Caveman from a tag/commit, not `curl|bash` of `main`; install
   RTK via a checksummed release (never `RTK_SKIP_CHECKSUM=1`). Avoid the `--with-init`/`--all`
   no-checksum path.
2. **Audit the hooks at rest.** After install, read `~/.claude/settings.json` (and project
   `.clinerules`/`.windsurfrules`) — nothing flags that hooks exist. Re-check after updates.
3. **Never `rtk trust` a `.rtk/filters.toml` you haven't read** — treat trusted filters as code
   review.
4. **Don't run `caveman-compress` on secret-bearing files**; the denylist is advisory. Review
   in-place rewrites before committing.
5. **Only put `caveman-shrink` in front of MCP servers you trust** (it doesn't sanitise a
   hostile upstream).
6. **Don't treat caveman-mode answers as authoritative on risk** — ask for full detail before
   irreversible/security-sensitive actions.
7. **Pin versions in shared/CI environments** and watch the upstream repos for
   ownership/maintainer changes.

> **Key idea:** the code in front of you today is not the risk — the code that replaces it
> tomorrow is. Treat both tools as supply-chain dependencies, not static artifacts, and pin
> accordingly.

The next post drills into the two findings above that deserved more rigor than a one-line
severity rating: Caveman's NUL-sentinel forgery and RTK's SQLite data-at-rest exposure — each
with a working proof of concept.

---

_Method: source-level audit (parallel auditor agents + firsthand verification incl. a live PoC)
cross-checked against an adversarially-verified web pass (6 angles, 31 sources, 16/25 claims
confirmed, 9 refuted)._

---

**Next:** [Part 3 — A NUL Sentinel, a ReDoS, and a Secret Left in Plaintext](/memo/posts/rtk-vs-caveman-part-3-shrink-deep-dive/) →

**The series — Shrinking the Agent Loop: RTK vs Caveman:**
[1 · How They Work](/memo/posts/rtk-vs-caveman-part-1-how-they-work/) ·
**2 · Living Inside the Trust Boundary (you are here)** ·
[3 · A NUL Sentinel, a ReDoS, and a Secret Left in Plaintext](/memo/posts/rtk-vs-caveman-part-3-shrink-deep-dive/)
