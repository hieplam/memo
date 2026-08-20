---
title: "Legs, Arms, and Cells — how to structure an LLM-agent eval so the verdict is a number, not prose"
description: "A design breakdown of a real detection eval for LLM coding agents: arm (memory bias control), leg (independent detector path), and cell (leg × arm, repeated for nondeterminism), ending in a five-gate numeric pass contract."
pubDatetime: 2026-08-20T09:00:00Z
lang: en
tags:
  - eval-design
  - llm-agents
  - factorial-design
  - detection-eval
multiLangKey: "legs-arms-cells-llm-eval-design"
---

## TL;DR

1. **"Verification must produce numbers, not prose."** A pass is a mechanical predicate evaluated
   over a grading JSON file, not a sentence in a report a human has to trust.
2. **Isolate the variable you're most afraid of biasing the result — call that an `arm`.** Here the
   feared variable is ambient memory (`CLAUDE.md` / project settings); the eval runs every
   detector twice, once with an empty sandbox and once with a memory fixture that never mentions
   the answer, and gates only on the empty one.
3. **Name each independent measurement path — call that a `leg`.** Two different agents doing two
   different jobs (sweeping code vs. reviewing a diff) are two legs; blending their scores into one
   number would hide which agent is actually broken.
4. **A `cell` is one leg × one arm — one square of the experiment matrix.** Run each cell 3 times
   and require 2-of-3 to pass, so one lucky (or unlucky) nondeterministic LLM run can't flip the
   verdict.
5. **A five-row gate table, not a paragraph, is the actual pass/fail contract** — see §6. Everything
   upstream of that table exists to make its five rows measure the real thing.

---

## 1. The problem: a self-improvement loop with an untested hinge

The **tribe** plugin (a multi-agent delivery system for Claude Code) has a self-improvement loop
that keeps its own rulebook honest:

```
Tracker (reviews a diff) --surfaces "harness gap"--> ledger --> Scout (adjudicates) --> new rule
        ^                                                                                  |
        \--------------------------- enforces the new rule afterwards ---------------------/
```

- **Tracker** reviews a code diff against the repo's *written* rules and, per its own charter,
  must report a **harness gap** — "the rule set is silent here" — when it sees a risky pattern no
  rule covers. It must never invent a rule on the spot and report a "violation" of something that
  doesn't exist.
- **Scout** periodically sweeps the standing codebase, infers conventions from repetition, and
  turns the strongest candidates into rule proposals.

The loop is only as good as these two detection doors. Before this design, tribe had 43 **role
evals** (`plugins/tribe/evals/evals.json`) — prompts describing a hypothetical situation, graded on
whether the agent stayed in its role — and almost none of them shipped real files. None measured
the actual capability the loop depends on: *inferring a convention that is written nowhere, from a
real codebase, and catching exactly where it breaks.* That gap is what this eval design closes.

## 2. The fixture: a small codebase with an answer key that never enters the sandbox

The eval needs a codebase where "the convention" is a fact you can check, not a matter of taste. It
builds one: **`orderly`**, a ~20-file TypeScript/bun order-service fixture that runs green
(`bun test` passes, `bunx tsc --noEmit` is clean) and is seeded with 10 conventions that are
**written nowhere** — no `CLAUDE.md`, no lint rule, no comment states them; they are only inferable
from repetition. Each convention has **≥3 exemplar sites** (enough repetition to infer the rule) and
**exactly one seeded deviation** (the one place it's broken) — plus 3 **decoys**: patterns that
repeat but are mere style taste, where flagging one counts as a false positive.

| ID | Tier | Unwritten convention | Seeded deviation |
|----|------|----------------------|-------------------|
| C1 | easy | Services return `Result` objects (`{ok:true,value}\|{ok:false,reason}`), never throw | one service throws |
| C3 | easy | Timestamps are UTC ISO strings, fields named `*AtUtc` | one file uses local `Date`, field named `createdAt` |
| C4 | medium | Clock is injected; nothing outside `clock.ts` calls `Date.now()` | one service calls `Date.now()` inline |
| C6 | medium | Every failure `reason` is a member of `errorCodes.ts` | one file invents an ad-hoc string |
| C9 | hard | Every mapper's `toDto()` strips internal fields — same name, same meaning everywhere | one mapper's `toDto()` leaks a field under the same name (diverged semantics) |
| C10 | hard | Money is integer cents everywhere; no float arithmetic | one module computes `* 1.1` on a float dollar amount |

*(Full 10 in the spec; C2/C5/C7/C8 follow the same shape. Decoys: alphabetical imports, a
`// module:` banner comment, single-quote style — real, repeated, and deliberately not
rule-worthy.)*

The **answer key** — `manifest/orderly.json`, with each convention's exemplars, deviation
`file:line`, and grading rubric — lives **outside** the fixture directory and is never copied into
the agent's working sandbox. This single placement decision is what makes the rest of the design
trustworthy: an agent that could read the manifest would trivially "pass" by copying it back.

## 3. Term — `arm`: isolate the variable you're afraid is biasing your measurement

**Arm** is standard terminology from randomized controlled trials (clinical-trial methodology): an
arm is one experimental *condition* applied to an otherwise identical measurement — e.g. a
treatment arm vs. a control (placebo) arm, with the delta between them causally attributable to the
one variable that differs. A/B testing is the same idea under a different name (A and B are arms).

This eval's isolated variable is **ambient memory** — the `CLAUDE.md` project file and
`.claude/`-scoped settings an agent can read before it even looks at the code. The concrete failure
this guards against, grounded in one sentence from the spec: *"a CLAUDE.md that says 'inject the
clock' hands \[the detector\] C4 for free"* — the agent would "catch" the clock-injection convention
because it was told, not because it inferred it from the code, and that recall point would be
fake. So the eval runs every detector in two arms:

```
clean arm  = the control: an EMPTY sandbox — no CLAUDE.md, no .claude/ project memory,
             no user settings, no MCP config. The unbiased measurement.
             --> the ONLY arm that gates pass/fail.

mem arm    = the treatment: the same scratch PLUS a realistic CLAUDE.md + project memory
             (build commands, generic style notes, fictional project blurbs) that is
             asserted, by a meta-test, to have ZERO lexical overlap with the manifest's
             convention/decoy descriptions.
             --> reported as Δrecall / Δprecision vs. clean, never gated.
```

The "asserted by a meta-test" clause matters: without it, someone editing the memory fixture six
months from now could accidentally reintroduce a hint, and the eval would quietly start measuring
"did the agent read its memory" instead of "did the agent infer the convention" — the exact bias
the arm split exists to prevent.

## 4. Term — `leg`: name each independent measurement path

**Leg**, in this design's own vocabulary (not an industry-standard term — it's local naming
introduced by this spec, worth flagging honestly), means *one detector, on one subject*. The tribe
loop has exactly two detection doors, so there are exactly two legs:

- **Leg A — Scout on standing code.** Dispatch the real `agents/scout.md` definition against the
  whole fixture. Expect it to name each of the 10 seeded conventions, point at the deviation site,
  and propose a rule candidate — without flagging any of the 3 decoys.
- **Leg B — Tracker on a diff.** Apply a prepared patch (`orderly-pr1.patch`, a plausible "add
  refunds endpoint" PR) that violates 4 of the conventions (C1, C4, C6, C10). Dispatch the real
  `agents/tracker.md` against that diff. The **correct** behavior is to surface each as a **harness
  gap** — a fact about the rule set being silent, not an invented rule with an invented violation.

Two legs exist because they measure **two different capabilities of two different agents**. A
single blended score (say, "73% detection") would hide *which* door is broken if the eval ever
fails — Leg A failing means Scout can't infer conventions from repetition; Leg B failing means
Tracker either misses real gaps or, worse, starts inventing rules. Those are different bugs in
different agents and need different fixes; one number can't tell you which.

## 5. Term — `cell`: one leg × one arm, repeated to absorb LLM nondeterminism

**Cell** is standard factorial-experiment-design vocabulary: in a factorial design, a *cell* is one
combination of factor levels — here, one (leg, arm) pair, one square of the 2×2 matrix:

```
              clean arm            mem arm
Leg A     [ Scout · clean ]    [ Scout · mem ]
Leg B     [ Tracker · clean ]  [ Tracker · mem ]
```

Each cell runs **3 repetitions**, because a single LLM call is nondeterministic — the same prompt
against the same fixture can produce a different report on different runs. A **repetition passes**
when every gate for its cell holds (§6); a **cell passes** when **≥2 of 3** repetitions pass. That
majority rule is deliberate: it absorbs one unlucky (or one lucky) run without either standard
being met by pure chance. One full benchmark invocation is therefore **2 legs × 2 arms × 3
repetitions = 12 detector runs**, each independently graded by a second, tool-less LLM call — **12
grader runs** — that scores every convention `caught` / `partial` / `missed` against the manifest.

## 6. The numeric pass contract — the actual gate table

This is the artifact the whole design serves: a fixed table of five gates, quoted verbatim from
the spec, that a script evaluates over `grading.json` — no human judgment call at pass time.

| Gate | Cell | Threshold |
|------|------|-----------|
| G1 | Leg A · clean | recall ≥ **0.70** (scoring: `caught`=1, `partial`=0.5, over the 10 conventions) |
| G2 | Leg A · clean | precision ≥ **0.70**, where `precision = caught / (caught + decoys_flagged + invented)` |
| G3 | Leg A · clean | easy-tier (C1–C3) recall = **1.00** — every easy convention, every counted rep |
| G4 | Leg B · clean | gap-recall ≥ **0.75** (≥3 of the 4 violated conventions surfaced as gaps) |
| G5 | Leg B · clean | invented-rule violations = **0** — Tracker citing a rule that doesn't exist hard-fails that repetition, no partial credit |

Two design choices worth naming explicitly, because they're easy to get backwards:

- **Gates apply only to the `clean` arm.** The `mem` arm never gates — it only ever produces two
  reported deltas (`Δrecall`, `Δprecision` vs. clean). Gating on `mem` would let a detector pass by
  reading its own memory instead of the code, which is precisely the failure mode §3 exists to rule
  out.
- **The eval PASSES iff both clean cells pass** (Leg A·clean **and** Leg B·clean, each by the 2-of-3
  rule). `benchmark.json` — the single output artifact — carries per-cell pass counts (`n/3`), both
  mem-arm deltas, and one top-level `"pass": true|false`; the process **exit code mirrors that
  boolean**, so a CI job can gate on it with no report-reading step at all.

```jsonc
// benchmark.json — the shape a script checks, not a human
{
  "legA_clean": { "reps_passed": 2, "reps_total": 3, "pass": true },
  "legB_clean": { "reps_passed": 3, "reps_total": 3, "pass": true },
  "legA_mem_delta": { "recall": +0.10, "precision": -0.05 },
  "legB_mem_delta": { "recall": +0.25, "precision": 0.00 },
  "pass": true
}
```

## 7. Takeaways

1. **"Verification must produce numbers, not prose."** The gate table in §6 is that principle made
   literal: a script reads `grading.json`, not a person reading a paragraph that says "looks good."
2. **Control your ambient context, or you're measuring the wrong thing.** Any eval run with the
   real `CLAUDE.md`/project memory present measures the memory as much as the model — split it into
   an `arm` (§3) and gate only on the memory-free one.
3. **Name your measurement paths.** Two agents doing two different jobs need two `legs` (§4), so a
   failure localizes to one capability instead of hiding inside a blended average.
4. **Repetitions + majority rule absorb nondeterminism without cheapening the bar.** 3 reps, 2-of-3
   per `cell` (§5) — a single lucky run can't pass the eval, and a single unlucky run can't fail it.
5. **Keep the answer key out of the sandbox, and test that invariant, not just assert it.** The
   manifest lives outside the fixture directory; a meta-test enforces zero lexical overlap between
   the `mem`-arm memory fixture and the manifest's convention text — otherwise the eval rots
   silently the first time someone edits either file.

## Sources

- `docs/superpowers/specs/2026-08-20-detection-eval-design.md` — todd-skills repo, `detection-eval`
  worktree; approved design spec, primary source for the fixture, gate table, and run flow in this
  note.
- "Arm" as standard clinical-trial / RCT terminology — any clinical-trials glossary (e.g. NIH/FDA
  glossaries of clinical trial terms) defines an arm as one group/condition in a trial compared
  against another for a causally attributable delta.
- Factorial experimental design — standard experimental-design texts define a *cell* as one
  combination of factor levels in a multi-factor design; this note applies that definition to a
  2×2 (leg × arm) matrix.
