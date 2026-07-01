---
title: "Shrinking the Agent Loop, Part 3: A NUL Sentinel, a ReDoS, and a Secret Left in Plaintext"
description: "A focused deep-dive into two findings that needed more rigor: a forgeable NUL sentinel in Caveman's MCP compressor, and a world-readable SQLite database where RTK quietly stores every command you've ever run."
pubDatetime: 2026-07-01T00:00:00Z
lang: en
tags:
  - security
  - mcp
  - sqlite
  - vulnerability-research
  - proof-of-concept
multiLangKey: "rtk-vs-caveman-3"
---

> **"Shrinking the Agent Loop: RTK vs Caveman" — Part 3 of 3.** A focused, proof-of-concept-backed
> deep dive into two findings from Part 2 that needed more rigor: Caveman's forgeable NUL sentinel
> and RTK's SQLite data-at-rest exposure. Closes out this source-level audit series.

---

Both findings below went through a source-level investigation plus an **adversarial
verification** pass — a second, independent check on the first pass's claims and severity
framing. Both severities are attacker-model-scoped.

## 1. Caveman-shrink `compress.js`: in-band NUL sentinel, semantic mangling, ReDoS

`caveman-shrink` is the opt-in MCP middleware proxy: it wraps an upstream MCP server and
regex-compresses the `description` fields on `tools/list` / `prompts/list` / `resources/list` /
`resourceTemplates` responses (confirmed: it never touches `tools/call` result content —
`index.js:81-106`). The deep-dive found **three** distinct defects.

### 1a. In-band NUL-sentinel forgery — LOW–MEDIUM (robustness flaw, PoC-proven)

**Mechanism (hex-confirmed).** To protect code/URLs/paths, `compress.js` replaces each protected
token with an **in-band sentinel made of NUL bytes**: `` `\x00${i}\x00` `` (NUL + segment-index +
NUL), then restores via `out.replace(/\x00(\d+)\x00/g, (_, i) => segments[+i])`. The NUL bytes
are literally in the source at `compress.js:67` and `:71` (confirmed by hex-dump — they render
as invisible/whitespace in every text viewer, which is why an earlier read mistook them for
spaces).

Because the delimiter is signalled **in-band**, an upstream that places raw NUL bytes into a
description (trivially, via a JSON `\u0000` escape — `JSON.parse` turns it into a real NUL) can
**forge sentinels**:

- **Attack A — in-range index (PROVEN):** a forged `\x00N\x00` where `N` indexes an existing
  protected segment makes the restore regex splice that segment's content (e.g. a URL) into the
  attacker-chosen prose position.
- **Attack B — out-of-range index (PROVEN):** `segments[+N]` is `undefined`; the `.replace`
  callback returns `undefined`, coerced to the literal string `"undefined"`.
- **Attack C — caveat _deletion_ (NOT achievable):** the restore regex is global; the legitimate
  sentinel for a real caveat segment is still present and restored at its natural position, so a
  forged duplicate makes the caveat appear at **both** locations, not zero. True erasure would
  require removing the legitimate sentinel, which no prose regex does. **Theoretical only.**

The proof of concept fetches the real, pinned upstream `compress.js` and drives it directly:

```js
// PoC — caveman-shrink NUL-sentinel forgery (target: compress.js @ v1.9.0)
const NUL = String.fromCharCode(0);

// Control: ordinary numbers, no NUL — the sentinel is NUL-delimited, so
// this is safe and passes through unchanged.
compress("Retry 3 times. Requires 2 approvals before delete.");
// -> unchanged

// [A] Forge an in-range sentinel \0N\0 where N indexes an already-protected
// segment (here, a URL) — splices that segment into the attacker's chosen spot.
compress(
  "Fetch https://good.example " +
    NUL +
    "0" +
    NUL +
    " ADMIN-ONLY: never expose secrets."
);
// -> "Fetch https://good.example https://good.exampleADMIN-ONLY: never expose secrets."

// [B] Forge an out-of-range index — segments[N] is undefined, and the
// .replace callback coerces it to the literal string "undefined".
compress(
  "Danger. " + NUL + "9" + NUL + " Requires confirmation before delete."
);
// -> "Danger. undefined Requires confirmation before delete."
```

Full runnable version: `poc/shrink-nul-sentinel.js` (fetches the pinned upstream file over
HTTPS and drives it live — no vendored copy, no simulation).

**End-to-end reachability (verified).** RFC 8259 permits `\u0000` in JSON strings; Node's
`JSON.parse` yields a real NUL; `compress()` does not strip it; `index.js` re-emits via
`JSON.stringify` (which encodes it back as `\u0000`); the host's `JSON.parse` decodes it to NUL
again. No stage sanitises NUL. So the corruption **does** reach the model.

**Honest severity — LOW–MEDIUM (adversarial verdict: PARTIAL).** The reachability leg is fully
confirmed, but the "net new attacker capability" framing is **wrong in the attacker's
favour-reducing direction**: the bug is **symmetric** — it corrupts the attacker's _own_
injected text too (their payload gets overwritten by a duplicated segment, or replaced with
`"undefined"`). A malicious upstream achieves cleaner arbitrary-text injection by simply
_writing the text directly_ (classic MCP tool-poisoning — no NUL needed). So this is an
**output-corruption / in-band-signalling robustness defect**, not a privilege escalation. No
crash; segments are local per `compress()` call (no cross-tool leakage).

### 1b. LEADERS regex mangles legitimate descriptions — LOW (correctness/safety, PoC-proven)

This one is arguably more interesting because it hits **honest** upstream servers, not just
malicious ones. The prose compressor's `LEADERS` regex (`compress.js:39-42`) strips
sentence-leading subjects:

```
/^(?:i'?ll|i will|i can|i'?d|you can|we will|we can|let me|let's)\s+/gim
```

PoC-proven semantic shifts:

- `"You can skip the security validation in test mode."` → `"Skip security validation in test
mode."` — a _permissive note_ becomes an _imperative command_.
- `"Let me warn you: never pass untrusted data…"` → `"Warn you: never pass untrusted data…"` —
  attribution/framing lost.

Good news (also verified): negations (`not`, `no`, `never`) are **not** in any strip-list, so
they're preserved — the compressor can't flip a prohibition into a permission by dropping "not".
But it _can_ re-cast hedged/permissive guidance as a directive. Treat compressed tool
descriptions as lossy.

### 1c. Quadratic ReDoS in the function-call protector — LOW (DoS, PoC-proven)

`PROTECTED_PATTERNS` includes `/[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)/g` (`compress.js:54`). On
input like `func(` + `"a"×N` with **no closing paren**, the engine does O(N) work at each of N
start positions → **O(N²)**. Measured: 1,000 chars = 2 ms, 5,000 = 37 ms, 10,000 = 149 ms,
50,000 = **3,738 ms**. A malicious upstream can stall the proxy with one long unterminated
identifier in a description. (Secondary: `\S` in the URL pattern matches NUL, so a NUL right
after a URL gets absorbed into the URL segment.)

### The fix (applies to 1a/1c)

```js
// 1) Reject/strip the in-band delimiter from input BEFORE processing:
text = text.replace(/\x00/g, ""); // NUL can never be legitimate here
// 2) Use an out-of-band placeholder keyed by a non-forgeable per-run token:
const TAG = "␞" + cryptoRandomHex() + ":"; // attacker can't predict it
//    ...replace protected matches with `${TAG}${i}␟`, restore by exact match.
// 3) Bounds-check on restore — leave unknown sentinels untouched, never emit "undefined":
out = out.replace(restoreRe, (m, i) => (i in segments ? segments[i] : m));
// 4) Bound the ReDoS pattern: cap the inner class, e.g. \([^)]{0,256}\) , and/or skip
//    compression for descriptions over a size budget.
```

**User mitigation today:** only point `caveman-shrink` at MCP servers you trust; it is opt-in
and does not sanitise a hostile upstream.

## 2. RTK SQLite tracking DB: data-at-rest exposure

### What is stored (source-confirmed)

RTK persists, on **every** invocation (filtered _and_ passthrough), into a local SQLite DB:

- Table `commands` (`tracking.rs:262-274`): **`original_cmd TEXT NOT NULL`** — the **verbatim
  full command string including all arguments** — plus `rtk_cmd` and **`project_path`** (the
  full canonicalised working directory).
- Table `parse_failures` (`tracking.rs:312-323`): `raw_command TEXT NOT NULL` — same verbatim
  exposure for commands RTK's parser couldn't handle.
- Command **output is NOT stored** (only the command string + token counts).
- **No redaction** of the command string before insert (the `env_cmd.rs` masking applies only
  to _output shown to the LLM_, not to the stored command). **No encryption** (plain
  `Connection::open` + WAL).

DB path: `~/Library/Application Support/rtk/history.db` (macOS) / `~/.local/share/rtk/history.db`
(Linux) — note the file is `history.db`. WAL side-files `history.db-wal` / `history.db-shm` sit
beside it.

### The permissions gap (the crux — adversarial verdict: PARTIAL, severity raised to MEDIUM)

The directory is created with `std::fs::create_dir_all(parent)` and **no explicit
`set_permissions`** (`tracking.rs:250-253`), so it inherits the process umask → typically
**`0755` dir / `0644` file = world-readable** on a default-umask system. The tell-tale: RTK
_does_ explicitly `chmod 0600` its telemetry `.device_salt` (`telemetry.rs:184-188`) — so the
omission on the much more sensitive `history.db` is an oversight, not a deliberate choice.

This is why the "it just mirrors shell history, so it's Low" framing is **only partly right**:

- Shell history (`~/.zsh_history`, `~/.bash_history`) is typically created **`0600`** by the
  shell. RTK's `0644` is a **real additional exposure** on multi-user / shared hosts and CI
  runners.
- RTK retention is bounded by automatic cleanup (`cleanup_old`, `tracking.rs:439-450`; default
  on the order of weeks-to-90-days — the exact constant had a minor discrepancy in review), but
  it's **time-based and fixed**, vs shell `HISTSIZE` line-bounded.
- Shell privacy tricks **don't apply**: `HISTCONTROL=ignorespace` (leading-space suppression),
  `HISTFILE=/dev/null`, env-var-prefix secrets — none of these prevent RTK from recording. RTK
  creates a **net-new, structured, trivially-queryable** copy at a **predictable path** even
  when you've disabled/purged shell history.
- The added `project_path` column correlates each command to a project (useful recon).
- **RTK's own `SECURITY.md:53` lists "tracking.db exposure" as a known concern** requiring
  enhanced PR review — the maintainers already recognise it.

### Secret-bearing commands that land in plaintext (realistic)

```
curl -H "Authorization: Bearer <API_TOKEN>" https://api…       # header value stored
psql "postgresql://dbuser:<DB_PASSWORD>@prod-db:5432/appdb"     # DB URI w/ password
mysql --password=<DB_PASSWORD> -h prod.db …                    # --password value
gh auth login --token <GH_TOKEN>                               # token
kubectl --token=<JWT> get pods                                 # bearer
git clone https://oauth2:<GITLAB_PAT>@gitlab.com/org/repo.git  # embedded cred
```

### Threat model & severity

- **Single-user dev machine:** LOW (same-UID processes can read it, but so can they read your
  shell history; FDE covers stolen-disk).
- **Multi-user / shared host / CI runner:** **MEDIUM** — `0644` lets _any local user_
  `sqlite3 history.db .dump` and read 90 days of timestamped commands incl. secret args.
- **Backups & cloud sync (Time Machine, iCloud, corporate backup, infostealers):** the
  **predictable, well-known path** makes it an indexed target; backups retain the exposure
  window even after the credential is rotated. Modern macOS infostealers (Atomic/AMOS/Lumma)
  already scan `~/Library/Application Support/`.
- **Telemetry is clean (verified):** the opt-in payload sends only aggregate counts + tool
  **names** (`top_commands` = `split_whitespace().nth(1)`; `low_savings_commands` = first 3
  tokens of `rtk_cmd`) — **no args, no paths, no output**. `TELEMETRY.md:109-117` explicitly
  lists "full command lines, arguments, file paths, secrets" as **NOT collected**. (Minor nit:
  `low_savings_commands` can include a subcommand like `rtk dotnet add package` — not a secret,
  but slightly more than "tool name only".)

### Fix / mitigation

**RTK should** (in priority order):

1. **Harden permissions at creation** — mirror the `.device_salt` treatment:
   `set_permissions(parent, 0o700)` + `set_permissions(db_path, 0o600)` (and the WAL side-files).
   Lowest effort, highest impact.
2. **Redact secret patterns before INSERT** — reuse the `env_cmd.rs` masking for
   `--password`/`--token`/`Bearer`/`:pass@` URIs.
3. **Add a `store-name-only` / `tracking.enabled=false` opt-out** for users who want analytics
   without forensic detail.
4. Surface a discoverable `rtk history clear [--before DATE]` (the `reset_all()` logic exists
   but is only reachable via `rtk telemetry forget`).

**User mitigation today (no code change):**

```bash
chmod 700 ~/.local/share/rtk && chmod 600 ~/.local/share/rtk/history.db*   # Linux
# macOS: chmod 700 ~/Library/Application\ Support/rtk && chmod 600 …/rtk/history.db*
# prune existing secret rows:
sqlite3 ~/.local/share/rtk/history.db \
  "DELETE FROM commands WHERE original_cmd LIKE '%token%' OR original_cmd LIKE '%password%' OR original_cmd LIKE '%secret%' OR original_cmd LIKE '%Bearer%';"
# keep telemetry off:
export RTK_TELEMETRY_DISABLED=1
```

## 3. Summary of refined ratings

| Finding                         | Initial | Refined (this deep-dive)                    | Why                                                                                                       |
| ------------------------------- | ------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| caveman-shrink NUL-sentinel     | LOW–MED | **LOW–MED** (confirmed)                     | Reachable but symmetric — corrupts attacker's own payload; not a capability gain                          |
| caveman-shrink LEADERS mangling | (new)   | **LOW**                                     | Re-casts _legitimate_ permissive notes as commands; negations safe                                        |
| caveman-shrink ReDoS            | (new)   | **LOW**                                     | O(n²); 50k chars ≈ 3.7s; malicious upstream can stall the proxy                                           |
| RTK SQLite data-at-rest         | LOW–MED | **MEDIUM** (multi-user) / LOW (single-user) | `0644` world-readable vs shell history's `0600`; net-new predictable copy; RTK's own SECURITY.md flags it |

> **Key idea:** both findings survived adversarial review, but in opposite directions — the
> caveman-shrink bug turned out to grant _less_ new capability than it first appeared, while the
> RTK data-at-rest gap turned out to be _more_ severe than "it's just shell history" suggests.
> That asymmetry is the whole reason the adversarial-verification pass exists.

That closes this series. Part 1 covered how the two tools actually shrink tokens; Part 2 laid
out the full risk-class picture; this post drilled into the two findings that needed a working
proof of concept before their severity could be trusted.

---

_Method: 4 focused source+PoC agents + 2 adversarial verifiers (both returned PARTIAL —
confirming the facts while correcting the severity framing in each direction). Full PoC:
`poc/shrink-nul-sentinel.js`._

---

**The series — Shrinking the Agent Loop: RTK vs Caveman:**
[1 · How They Work](/memo/posts/rtk-vs-caveman-part-1-how-they-work/) ·
[2 · Living Inside the Trust Boundary](/memo/posts/rtk-vs-caveman-part-2-security/) ·
**3 · A NUL Sentinel, a ReDoS, and a Secret Left in Plaintext (you are here)**
