---
title: "Claude Code Loops: What 'Designing a Loop' Actually Means — and What the Docs Don't Tell You"
description: "Everyone on X uses 'loop' to mean something different. This breaks down Claude Code's four loop types by what you hand off, then verifies the mechanics the marketing post skips: /goal has no built-in turn cap, /loop dies with your session, and /schedule is still a research preview."
pubDatetime: 2026-07-07T09:00:00Z
lang: en
tags:
  - claude-code
  - ai-agents
  - loops
  - automation
  - dynamic-workflows
multiLangKey: "claude-code-loop-primitives"
---

Spend ten minutes on X reading people "designing loops" for their coding agent and you'll notice nobody agrees on what a loop *is*. To one person it's a recurring cron job. To another it's just "let Claude keep trying until tests pass." To a third it's a whole multi-agent orchestration pipeline. Same word, three different mental models — and if you build a mental model from the wrong one, you'll reach for the wrong tool the first time you need one.

Claude Code's own team settled on one definition: **a loop is an agent repeating cycles of work until a stop condition is met.** Everything else — how it's triggered, how it stops, which primitive runs it — is just a variable. Once you see it that way, "which loop do I need" stops being a vibe and becomes a checklist: what am I handing off, and what am I keeping control of?

This post distills a deep-research pass (108 sub-agents, 25 sources, 24 of 25 claims independently confirmed, 1 refuted) that fact-checked the ClaudeDevs article ["Getting started with loops"](https://x.com/ClaudeDevs/article/2074208949205881033) (@delba_oliveira) against Claude Code's actual docs. The taxonomy below is the article's; the mechanics are what survived verification. Full citations in the [companion research note](https://github.com/hieplam/research/blob/master/raw/claude-code-loop-primitives-en.md).

## The four loop types, by what you hand off

| Loop | You hand off | Use it when | Reach for |
|---|---|---|---|
| Turn-based | The check | You're exploring or deciding | Custom verification skills |
| Goal-based | The stop condition | You know what done looks like | `/goal` |
| Time-based | The trigger | The work happens outside your project, on a schedule | `/loop`, `/schedule` |
| Proactive | The prompt itself | The work is recurring and well-defined | All of the above, plus dynamic workflows |

Every plain prompt you send is already a manual loop — Claude gathers context, acts, checks its own work, repeats if needed, hands control back to you. The three primitives below just progressively take over more of that loop, in exchange for you having progressively less turn-by-turn say.

That's the framing. Here's what the article doesn't spell out about how each one actually behaves — the part that matters once you're relying on it for something that isn't a toy example.

## `/goal`: no built-in cap, and it can't see anything you don't say out loud

`/goal` lets a session keep iterating until a natural-language condition is met, instead of stopping after one turn. The mechanism, verified 3-0 across independent checks: after every turn, a small fast model (default Haiku) reads your condition plus the conversation transcript, and returns yes/no plus a short reason. A "no" feeds that reason back into Claude's next turn.

Two things worth knowing before you rely on this for anything unattended:

- **There is no built-in turn or time cap.** The docs' own example — `/goal get the homepage Lighthouse score to 90 or above, stop after 5 tries` — works because *you* wrote "stop after 5 tries" into the condition text. There's a hard backstop around 500 Stop-hook continuations as a runaway guard, but that's a circuit breaker, not a dial you set. If you don't write a cap into the condition, there effectively isn't one.
- **The evaluator only sees the transcript — no tools, no file access.** It's judging what Claude *said* happened, not independently checking what actually happened. If your condition is "the build passes," write it so Claude is forced to paste the actual exit code or test output into the conversation — otherwise the evaluator is grading a claim, not a fact. Conditions cap at 4,000 characters, and Anthropic's own guidance is that they should be deterministic: one measurable end state, a check Claude's output can demonstrate, explicit invariants that shouldn't change along the way.

## `/loop`: it's a Skill, and it dies with your session

`/loop` reruns a prompt while your session stays open — either on a fixed interval (`/loop 5m check my PR...`) or, if you omit the interval, self-paced: Claude picks each delay itself (1 minute to 1 hour) via the `ScheduleWakeup` tool, based on what it observes, and can end the loop itself by calling that tool with `stop: true`.

The detail that matters operationally: **`/loop` is local and session-bound.** Close the terminal, close the laptop, end the session — the loop stops. There's a safety net (if an iteration forgets to reschedule or stop, Claude Code schedules one fallback wakeup ~20 minutes later), but no persistence across a closed session. If you need the loop to survive you closing your laptop, `/loop` is the wrong primitive — that's what `/schedule` is for.

## `/schedule`: real cloud persistence, but still labeled research preview

`/schedule` moves the same idea to Anthropic-managed cloud infrastructure as a "routine" — configured conversationally, no config file. The trade you're making versus `/loop`: routines survive your laptop closing and run with **zero permission prompts**, a genuinely different trust model. The three scheduling primitives differ sharply here:

| Primitive | Permission prompts |
|---|---|
| Cloud routine (`/schedule`) | None — fully autonomous |
| Desktop scheduled task | Configurable per task |
| `/loop` | Inherits the current session's settings |

One safety detail worth knowing: as of Claude Code v2.1.196, a scheduled `/loop` fire only auto-executes a skill or command Claude is already independently permitted to invoke unattended — anything gated by `disable-model-invocation`, a `skillOverrides` deny rule, or a built-in like `/permissions` arrives as inert text instead of executing. A scheduled fire can't use itself to escalate its own permissions.

The caveat to carry forward: `/schedule` — and the separate, opt-in agent-teams feature — are explicitly labeled **research preview / experimental** by Anthropic. Treat exact mechanics and version gates as accurate as of this snapshot, not as a stable API to build a business process on without re-checking.

## Dynamic workflows: the harness costs nothing, the judge needs its own context

Dynamic workflows let Claude write its own orchestration script — a JS file with functions to spawn and coordinate subagents — on the fly. The orchestration code itself **costs no model tokens**; only the spawned agents' work does. The script can route each subagent to a different model and optionally run it in an isolated git worktree, so you can, say, migrate every component in its own conflict-free copy, or explore three competing bug fixes in parallel.

The pattern worth stealing for any orchestration you build yourself: both dynamic workflows and the experimental agent-teams feature document the same fix for **self-preferential bias** — a model tends to favor its own prior findings when the producer and the judge share context. The fix is structural, not a prompting trick: run the judge as a *separate spawned agent, in a separate context window*, grading the producer's output against a rubric. Agent-teams docs extend this to debugging specifically: multiple teammates independently investigating and actively trying to disprove each other's theories converges on the real root cause faster than one agent anchoring on its first hypothesis.

For anything unattended, permission handling is centralized at the lead, not distributed — and there's one detail that matters if you're chaining agents together: **the auto-mode classifier treats an "approval" relayed from one agent to another as untrusted input, never as user consent.** One agent can't vouch for you to unblock another.

## Verification skills: not from the loops article, from the skills docs

The loops article gestures at "encode what good looks like with skills" — but the concrete guidance that survived verification comes from Anthropic's separate skill-authoring best-practices doc: a **plan-validate-execute** pattern (write a structured plan, validate it with a script, only then execute), an explicit **"run validator → fix errors → repeat"** loop, and preferring deterministic scripts over Claude-generated code, because a script's source never enters context — only its output costs tokens.

There's one specific claim from the source article worth flagging by name, because it's plausible enough to quietly become gospel: the suggestion that verification skills should prescribe browser-automation screenshot diffing and a Core Web Vitals audit via Chrome DevTools MCP **did not survive adversarial verification** — voted down 0-3. That's not "browser testing is wrong," it's that this specific prescription isn't an officially confirmed best practice the way plan-validate-execute is. If you're writing a verification skill, ground it in the validator-loop pattern and the bundled `/run`/`/verify` skills, not in that specific recipe.

## Getting started, without over-building

Not every task needs a loop at all — start with the plain single-turn prompt, and only reach for one of these when you can name what you're handing off:

- **Can you write the check?** → a verification skill, still turn-based.
- **Do you know what "done" looks like, precisely?** → `/goal`, with a cap written into the condition.
- **Does the work arrive on a schedule, and can it survive you closing your laptop?** → `/schedule`; if not, `/loop` is enough.
- **Is the work recurring, well-defined, and does it need parallel investigation or a second opinion?** → dynamic workflows, with the judge in its own context.

Pick the smallest primitive that matches what you're actually handing off, run it, and watch where it stalls or over-reaches before reaching for the next one up.
