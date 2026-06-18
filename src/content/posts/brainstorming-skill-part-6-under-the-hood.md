---
title: "Inside the Brainstorming Skill, Part 6: Under the Hood"
description: "An appendix. Parts 0–5 documented what the brainstorming skill does; this one opens the visual companion and looks at the machinery — a zero-dependency Node server with a hand-rolled WebSocket, a filesystem seam between the agent and the browser, and a security model for a localhost server that might not stay on localhost."
pubDatetime: 2026-06-18T00:00:00Z
lang: en
tags:
  - claude-code
  - superpowers
  - skills
  - brainstorming
  - visual
  - architecture
  - websocket
  - agent-design
---

> **"Inside the Brainstorming Skill" — Part 6 of 7 (appendix).** Parts 0–5 documented what the skill
> does; this one opens the visual companion and looks at the machinery — a zero-dependency Node server
> with a hand-rolled WebSocket, a filesystem seam between agent and browser, and a security model for a
> localhost server that might not stay on localhost. Source-grounded; every claim is cited `file:line`.

---

The first six posts (0 through 5) documented the brainstorming skill as _behavior_ — the
Socratic interview, the gates, the visual companion as seen by the user. This appendix is for
the curious: it opens the hood of that visual companion and looks at the code underneath.

The question it answers is the one most people ask first: **a skill is supposed to be markdown
instructions — so why does this one ship a folder of scripts?**

## What's actually in the folder

Under `skills/brainstorming/scripts/` there are five files, ~1,400 lines total:

| File                  | Lines | Role                                                                 |
| --------------------- | ----: | -------------------------------------------------------------------- |
| `start-server.sh`     |   209 | Launcher — port, session dir, key, backgrounding, watchdog wiring    |
| `server.cjs`          |   723 | The server — HTTP + a hand-rolled WebSocket, file-watching, auth     |
| `helper.js`           |   167 | Client side, injected into every screen — clicks, reconnect, overlay |
| `frame-template.html` |   213 | Page chrome + the CSS classes the agent writes against               |
| `stop-server.sh`      |   120 | Teardown — prove identity, then SIGTERM → SIGKILL                    |

None of this touches the Socratic _method_. It exists for one feature — the visual companion of
Part 5 — and nothing else. Decline the companion and not a line of it runs.

## The reason a server has to exist

An AI agent acts in **discrete turns**. It writes some output, ends its turn, and waits. A
browser, meanwhile, is **real-time** — it holds an open connection and reacts to clicks the
instant they happen. These two clocks don't line up, and the agent cannot bridge them itself: it
isn't running between turns, so it can't serve a page or receive a click.

So the skill inserts a long-lived process between them. And the elegant part is _how_ the agent
and that process communicate — they don't, directly. They communicate through the **filesystem**.

![Why the skill ships a server — the data flow](/memo/diagrams/brainstorming-skill/06-architecture.svg)

Trace the eight steps in the diagram:

1. The agent **writes** a semantic HTML file into the session's `content/` directory
   (`server.cjs` reads this dir; the agent's only job is to drop a file there).
2. The server's `fs.watch` on that directory **fires**, debounced ~100ms
   (`server.cjs:590–613`).
3. The server **pushes** `{type:"reload"}` to every connected browser over the WebSocket
   (`server.cjs:519–524, 611`).
4. The browser **re-requests** `GET /?key=…` (`helper.js:100` reloads on that message).
5. The server **serves** the newest screen by mtime, wraps a fragment in the frame template,
   and injects `helper.js` (`server.cjs:406–419, 267–278`).
6. The human **clicks** an option; `helper.js` ships a WebSocket event back
   (`helper.js:130–141`).
7. The server **appends** that click to `state/events`, one JSON object per line
   (`server.cjs:513–516`).
8. On its **next turn**, the agent reads `state/events` and merges it with the terminal reply
   (this is the loop from Part 5).

The whole architecture falls out of one sentence: _the filesystem is the seam between the
agent's turn-based world and the browser's real-time world._ The agent and the server never
hold a connection to each other — the agent writes files and reads files; the server watches
files and serves a browser. That decoupling is why a turn-based agent can drive a live UI at
all.

## Why zero dependencies — and a WebSocket written by hand

Open `server.cjs` and the first four lines are the whole dependency list
(`server.cjs:1–4`):

```js
const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const path = require("path");
```

All four are Node built-ins. There is no `express`, no `ws`, no `chokidar`. That is deliberate,
and the design spec spells out why (`2026-03-11-zero-dep-brainstorm-server-design.md:3,7`):

> "Replace the brainstorm companion server's vendored node_modules (express, ws, chokidar — 714
> tracked files) with a single zero-dependency `server.js`… Vendoring node_modules into the git
> repo creates a supply chain risk: frozen dependencies don't get security patches, 714 files of
> third-party code are committed without audit."

So the server was rewritten to depend on nothing — which meant **implementing the WebSocket
protocol by hand**. `server.cjs:6–81` is a compact RFC 6455 implementation: the SHA-1 +
magic-GUID handshake (`computeAcceptKey`, `server.cjs:12–14`), frame encode/decode across the
three length encodings, XOR-unmasking of client frames, and exactly four opcodes — TEXT, CLOSE,
PING, PONG (`server.cjs:8`). Binary frames, fragmentation, and extensions are _deliberately_
skipped because the only payloads are small JSON click events between localhost peers
(`design spec:33`). A 10 MB frame cap (`server.cjs:10`) guards against a hostile client.

This is what lets Superpowers' own `CLAUDE.md` claim the project is _"a zero-dependency plugin by
design."_ The companion server isn't an exception to that rule; it was rebuilt to honor it.

> **One honest caveat.** Zero _npm_ dependencies does not mean zero network calls. The
> companion's frame optionally loads a Prime Radiant branding logo from a remote URL for
> rough usage telemetry (`server.cjs:106, 242–252`). It's opt-out — set
> `SUPERPOWERS_DISABLE_TELEMETRY` (or `DISABLE_TELEMETRY`) and the logo, and its request, are
> dropped (`server.cjs:107–112, 244–249`). The server code itself pulls in no third-party
> packages.

## Why the extension is `.cjs`

A small detail with a real reason. The file does double duty (`server.cjs:712–723`):

```js
if (require.main === module) {
  startServer();          // run directly: `node server.cjs` starts the server
}
module.exports = {        // required from a test: export the protocol functions
  computeAcceptKey, encodeFrame, decodeFrame, browserLauncherForPlatform, OPCODES, …
};
```

The `.cjs` extension pins the file to CommonJS regardless of any surrounding ESM package config,
so `require()` always works. That is what lets `tests/brainstorm-server/ws-protocol.test.js`
import `encodeFrame`/`decodeFrame` and unit-test the hand-rolled protocol in isolation — while
the _same file_, run directly, is the server. One file, two roles, exactly as the design spec
intended (`design spec:11–14`).

## The security model: a localhost server that might not stay on localhost

This is the most interesting code in the folder, because the companion can be told to bind a
non-loopback host for remote/containerized setups (`start-server.sh:11–12`). The moment it does,
"it's just localhost" stops being a defense. The server's answer is a **per-session key**.

- On startup it mints a 32-byte hex token (`server.cjs:124–126`) and bakes it into the served
  URL as `?key=…` (`server.cjs:286–288`).
- Every request must carry that key — as the query param or as a cookie — and the comparison is
  **constant-time** to avoid timing leaks (`isAuthorized`, `server.cjs:341–353`;
  `timingSafeEqualStr`, `server.cjs:321–326`). No key → `403` (`server.cjs:388–392`).
- On first load a tiny bootstrap page stashes the key in `sessionStorage` and mirrors it into an
  `HttpOnly; SameSite=Strict` cookie (`server.cjs:188–200, 398–399`), so subsequent
  subresources and the WebSocket carry it automatically.
- The WebSocket upgrade is gated by the same key **plus an Origin check**
  (`server.cjs:445`, `isAllowedWebSocketOrigin`, `server.cjs:377–383`), and responses carry
  `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`
  (`server.cjs:366–375`). The comment is explicit that this combination is what **defeats DNS
  rebinding**, which a Host/Origin allowlist alone cannot (`server.cjs:115–120`).
- Static file serving is hardened against path traversal: `isRegularFileInsideContentDir`
  (`server.cjs:304–317`) rejects symlinks, hardlinks, and anything whose real path escapes the
  content directory.

For a feature whose pitch is "I'll pop open a browser tab," there is a surprising amount of
adversarial thinking here — precisely because a careless version would be a local-network
information leak.

## Lifecycle: starting, surviving, and dying cleanly

A server spawned by a turn-based agent has a basic problem: **who turns it off?** The skill
solves this with two independent shutdown triggers and a careful launch.

**Starting** (`start-server.sh`): it generates a unique session id (`$$-timestamp`,
`start-server.sh:114`), resolves the _harness_ PID as the server's owner — the grandparent of the
script, since the immediate parent is an ephemeral shell that dies when the script exits
(`start-server.sh:153–159`) — and backgrounds the server with `nohup … & disown`
(`start-server.sh:180–183`) so it survives the turn. It then polls the log for `server-started`
and re-checks that the process is _still alive_ a beat later, to catch environments that reap
detached processes (`start-server.sh:185–205`). On Codex and Windows/Git Bash, which reap
background processes, it auto-switches to foreground mode (`start-server.sh:97–107`).

**Surviving / dying** (`server.cjs`): a watchdog runs every 60 seconds (`server.cjs:640–644`)
and shuts the server down if **either** the owner harness has exited
(`ownerAlive` via `process.kill(pid, 0)`, `server.cjs:634–637`) **or** it has been idle past the
timeout (default 4 hours, `server.cjs:552–557`). If the preferred port is taken it falls back to
a random one exactly once (`server.cjs:691–708`). And when it gets its preferred port it persists
the port and token to `.last-port`/`.last-token` (`server.cjs:663–680`), so a restart with the
same `--project-dir` reuses them — which is why an already-open browser tab silently reconnects
instead of 403-ing (the tab's cookie still validates).

**Stopping** (`stop-server.sh`): it refuses to kill a PID it can't _prove_ is this server,
matching a per-start instance id baked into the process's command line
(`stop-server.sh:43–71`) — a stale PID file after a reboot fails closed as `stale_pid` rather
than risking signalling an unrelated process (`stop-server.sh:78–83`). It tries SIGTERM, waits
~2s, then escalates to SIGKILL (`stop-server.sh:85–102`). Ephemeral `/tmp` sessions are deleted;
persistent `.superpowers/` sessions are kept so the mockups survive for later review
(`stop-server.sh:112–115`).

## The client half: `helper.js`

The browser side is small but does the unglamorous work that makes the loop feel solid
(`helper.js`):

- Opens the WebSocket using the key from `sessionStorage` (`helper.js:25–35, 77–95`).
- Captures clicks on any `[data-choice]` element and sends `{type, text, choice, id}`
  (`helper.js:130–141`); queues events while disconnected and flushes on reconnect
  (`helper.js:120–127, 89–90`).
- Reconnects with exponential backoff from 500 ms to 30 s (`helper.js:1–8, 112–113`).
- After 15 s disconnected, paints a full-screen **"Companion paused"** overlay so the human
  isn't staring at a dead page (`helper.js:62–75, 103–111`) — and tears it down and reloads
  through the keyed bootstrap when the server comes back (`helper.js:82–95, 37–44`). This is the
  same-port restart, seen from the browser's side.

## What the machinery teaches about the skill

Step back and the scripts are a small case study in the same values the prose half of the skill
preaches:

- **YAGNI, applied to dependencies.** Three npm packages became zero by implementing only the
  4 opcodes and 3 routes actually needed. The companion does the minimum a browser dialogue
  requires and not one feature more.
- **Decoupling through a clean seam.** The agent and server share _files_, not a connection — the
  same "well-bounded units with a clear interface" idea the design section of `SKILL.md`
  espouses, expressed in process architecture.
- **Adversarial care.** Constant-time keys, DNS-rebinding defense, path-traversal guards, and a
  kill-only-what-you-can-prove teardown — for a localhost convenience feature. It is the
  spec-self-review instinct (Part 4) turned on the runtime itself.

So: the scripts are there because one feature — and only one — needs to render in a browser and
hear clicks back. Everything about _how_ they're built (zero-dependency, hand-rolled WebSocket,
keyed auth, a filesystem seam, a self-terminating watchdog) follows from a single constraint:
ship a live localhost server _inside a zero-dependency plugin_ without letting it become a
liability. That constraint, met carefully, is the whole story under the hood.

---

### Sources

- `skills/brainstorming/scripts/server.cjs` — lines 1–4 (built-ins only), 6–81 (RFC 6455
  WebSocket), 115–150 & 321–353 & 366–399 (key auth, cookie, security headers), 304–317
  (path-traversal guard), 387–438 (HTTP routes), 503–524 (WS messages & broadcast), 552–644
  (idle timeout & owner-PID watchdog), 663–710 (port/token persistence, EADDRINUSE fallback,
  startup JSON), 712–723 (dual role / `module.exports`)
- `skills/brainstorming/scripts/helper.js` — lines 1–8 & 112–113 (backoff), 62–75 & 103–111
  (paused overlay), 120–141 (click capture & queueing)
- `skills/brainstorming/scripts/start-server.sh` — lines 97–107 (auto-foreground), 113–124
  (session dir), 153–159 (owner PID), 180–205 (background launch & alive check)
- `skills/brainstorming/scripts/stop-server.sh` — lines 43–83 (identity proof / fail closed),
  85–115 (SIGTERM→SIGKILL, keep persistent dirs)
- `docs/superpowers/specs/2026-03-11-zero-dep-brainstorm-server-design.md` — lines 3,7
  (motivation: 714 vendored files), 11–35 (single-file dual role; WebSocket protocol scope)
- `CLAUDE.md` — "Superpowers is a zero-dependency plugin by design"

---

← **Previous:** [Part 5 — The Visual Companion](/memo/posts/brainstorming-skill-part-5-the-visual-companion/) · This appendix closes the series.

**The series — Inside the Brainstorming Skill:** [0 · The Map](/memo/posts/brainstorming-skill-part-0-the-map/) · [1 · Dialogue, Not Interrogation](/memo/posts/brainstorming-skill-part-1-dialogue-not-interrogation/) · [2 · The Interview Engine](/memo/posts/brainstorming-skill-part-2-the-interview-engine/) · [3 · From Answers to Design](/memo/posts/brainstorming-skill-part-3-from-answers-to-design/) · [4 · The Spec Pipeline](/memo/posts/brainstorming-skill-part-4-the-spec-pipeline/) · [5 · The Visual Companion](/memo/posts/brainstorming-skill-part-5-the-visual-companion/) · **6 · Under the Hood (you are here)**
