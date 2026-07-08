---
title: "/loop vs /schedule in Claude Code: Same Idea, Two Very Different Machines"
description: "/loop and /schedule both repeat a prompt, but they aren't two settings on one dial. /loop is a local cron tied to your live session; /schedule is an isolated cloud job. Mixing up their assumptions is how you build a cron that multiplies itself every 30 minutes — a bug I hit and fixed live."
pubDatetime: 2026-07-08T02:00:00Z
lang: en
tags:
  - claude-code
  - ai-agents
  - loops
  - automation
  - cron
multiLangKey: "claude-code-loop-vs-schedule"
---

I was babysitting a long-running Claude Code workflow — ten improvement cards, each implemented, adversarially reviewed by three independent lenses, then merged, one at a time. It kept dying mid-run, not from a bug but from hitting the 5-hour session token limit. Pause, resume, pause, resume. So I set up `/loop 30m` to auto-resume it instead of me typing "continue" every time.

Thirty minutes later, a `/loop` command fired that I never typed. Not a hallucination, not a stray keystroke — the schedule I'd built was working exactly as configured. The configuration was just wrong, in a way that would have quietly doubled itself every half hour if left alone. Chasing that down surfaced the actual mechanism under `/loop` and `/schedule` — which turns out not to be "two speeds of the same thing."

## They don't share an engine

The docs describe both as ways to repeat a prompt. That's true at the level of intent, and it's exactly where the resemblance ends.

**`/loop` in fixed-interval mode is a thin wrapper over the same primitive you'd call directly: `CronCreate`.** There's no separate loop engine — a `/loop 30m <prompt>` and a hand-built `CronCreate({cron: "*/30 * * * *", prompt: ...})` are the same object under the hood. (`/loop`'s *dynamic*, no-interval mode is different again — it self-paces via `ScheduleWakeup` instead, picking its own delay each iteration.)

**`/schedule` doesn't touch your session's cron at all.** It calls a different API (`RemoteTrigger`) that provisions a job on Anthropic's cloud infrastructure — a completely separate system from anything running on your machine.

That split in mechanism is why the two differ on every practical axis that matters:

| | `/loop` (fixed-interval) | `/schedule` (routine) |
| --- | --- | --- |
| Runs on | Your machine, inside the current session | Anthropic's cloud — a fresh isolated session per fire |
| Survives session close / laptop off | No — dies with the session | Yes — runs unattended indefinitely |
| Lifespan | Auto-expires after 7 days | Runs until you disable or delete it |
| Context | Full access to your live session — files, tools, running state | Zero prior context; starts from a clean git checkout each time |
| Minimum interval | 1 minute | **1 hour** |
| Permissions | Inherits the session's current permission state | Fully autonomous, no permission prompts (research preview) |

Reading that table the way I should have read it going in: **`/loop` is for babysitting something that's already happening in front of you.** `/schedule` is for work that has to happen whether or not you — or this session — exist. They're not interchangeable, and picking the wrong one for the job produces exactly the kind of bug I hit.

## The bug: a loop that reschedules itself

Here's what I actually built, condensed to the part that mattered:

```
CronCreate({
  cron: "*/30 * * * *",
  prompt: "/loop 30m Auto-resume the workflow...",
  recurring: true
})
```

Looks reasonable — the prompt just says what I want done every 30 minutes. But `/loop` is a *skill*, not inert text. When the prompt is `/loop 30m <task>`, firing it doesn't run `<task>` — it **re-enters the `/loop` skill**, which parses out the interval and prompt again and calls `CronCreate` a second time.

Trace the timeline: cron A fires → creates cron B → cron A's own schedule still exists → cron A fires again → creates cron C → and so on. Nothing crashes. Nothing errors. You just quietly accumulate schedules, each one now also capable of spawning more, until — sooner or later — you have a pile of overlapping jobs all trying to do the same thing at once.

The fix was one word's worth of understanding: **the stored prompt must be the bare task, never wrapped back in the invoking command.**

```
CronCreate({
  cron: "*/30 * * * *",
  prompt: "Auto-resume watchdog for the workflow. Do NOT call /loop or CronCreate — just run the check once and end the turn.",
  recurring: true
})
```

Same cadence, same intent — but now each fire executes the task and stops, instead of re-triggering the machinery that created it.

## The generalizable rule

If you're wiring up recurring work in Claude Code, the question that actually matters isn't "how often" — it's **"does this survive without me, and does its own prompt know it's not supposed to reschedule itself?"**

- Something you're actively watching, tied to this session, that should stop existing when you close the laptop → `/loop`, and make sure its stored prompt is the plain task, not another invocation of `/loop`.
- Something that must fire regardless of whether you or this session are around, on an hourly-or-coarser cadence → `/schedule`.

The failure mode I hit doesn't show up as an error message. It shows up as a command you never typed, firing on a timer you forgot you set — which is exactly why it's worth knowing the mechanism, not just the command name.
