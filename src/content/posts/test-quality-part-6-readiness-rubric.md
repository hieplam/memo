---
title: "Beyond Coverage, Part 6: The Agentic Merge-Gate Readiness Rubric"
description: "A scorecard and an autonomy ladder for deciding, module by module, when a legacy suite is strong enough to let an agent merge on green without a human re-testing the change."
pubDatetime: 2026-07-01T00:05:00Z
lang: en
tags:
  - testing
  - agentic-ai
  - mutation-testing
  - code-coverage
  - ci-cd
  - test-quality
multiLangKey: "test-quality-metrics-6"
---

> **"Beyond Coverage: Test Quality for the Agentic Loop" — Part 6 of 7 (closing part).** Six
> parts of metrics, evidence, tooling, and AI-test grading converge here into one scorecard and
> a rollout plan — scored on the diff, module by module, never on the repo as a whole.

Score the **diff**, not the repo. A change is safe to merge without manual testing when, on the
lines it touches: mutation score ≥ 80%, diff coverage ≥ 90%, zero test smells, ~0% flakiness,
and critical paths carry strong (mutation + property) oracles. You reach the loop
**module-by-module**, hardening the crown jewels first — never by chasing one repo-wide number.

---

## The scorecard (apply per PR, to changed code)

| Dimension             | Metric                                            | 🔴 Not ready   | 🟡 Workable    | 🟢 Loop-ready                   |
| --------------------- | ------------------------------------------------- | -------------- | -------------- | ------------------------------- |
| **Oracle strength** ★ | Mutation score on the diff                        | < 50%          | 60–75%         | **≥ 80%**                       |
| **Change exercised**  | Diff / changed-line coverage                      | < 60%          | 70–80%         | **≥ 90%**                       |
| **Assertions exist**  | Assertion density + smell scan                    | smells present | ≥1 assert/test | **0 smells, behavioural**       |
| **Reliability**       | Flakiness (5× rerun)                              | > 1%           | ≤ 0.5%         | **≈ 0%, flakes quarantined**    |
| **Critical paths**    | Mutation + property tests on money/auth/data-loss | gaps           | covered        | **≥ 90% mutation + invariants** |
| **Speed**             | Suite + diff-mutation runtime                     | hours          | ~10 min        | **diff-scoped, minutes**        |

![Agentic merge-gate readiness scorecard, scoring six dimensions from not-ready to loop-ready](/memo/diagrams/test-quality-metrics/05-readiness-scorecard.svg)
_"Is my legacy suite good enough to merge AI changes without manual testing?" Score the diff, not the whole repo._

These are **starting defaults** (Stryker.NET's `high:80 / low:60` baseline; Meta/industry diff
gates), to be **tuned per module risk** — not laws of nature. The payment path should be
stricter; a logging helper can be looser.

## The autonomy ladder — earn each rung with evidence

You don't flip a switch to "autonomous." You climb:

- **L0 · Manual** — coverage only, smells present, flaky. Human tests every PR. _(Most legacy
  code starts here.)_
- **L1 · Assisted** — diff-coverage gate + smell scan are green. Human still reviews and
  lightly tests.
- **L2 · Supervised auto** — diff-**mutation** gate green + flakiness budget held. Merge on
  green, human spot-checks.
- **L3 · Autonomous** — all six scorecard dimensions green on the diff, critical paths carry
  properties. **No manual test before merge.**

The jump that actually buys you the loop is **L1 → L2**: adding the _mutation_ gate. Coverage
gates (L1) stop obviously-untested merges; mutation gates (L2) stop _vacuously_-tested merges —
including the AI's vacuous tests (Part 5).

## "Is my legacy suite good enough?" — the decision procedure

Run this, in order, scoped to the code a given change touches:

1. **Coverage zeros?** Any changed/critical line at 0% → not ready. _(Coverlet / `go test
-cover`.)_ Cheap, do it first.
2. **Surviving mutants?** Run diff-scoped mutation (`stryker --since` / `gremlins --diff`).
   **Read the survivors.** Each is a missing assertion or case. Zero non-equivalent survivors on
   the diff = the strong signal you want.
3. **Smell scan clean?** No assertion-free, magic-number, conditional-logic, or
   act-assert-mismatch tests on the change.
4. **Critical path hardened?** For money/auth/data-loss, is there a _property/invariant_ test,
   not just examples?
5. **Flake-free & fast?** 5× rerun stable; run completes in minutes.

If 1–5 pass on the diff, that change is **loop-ready** even if the _rest_ of the legacy repo is
a swamp. That's the whole point: **you don't have to fix the legacy repo to start the loop —
you have to fix the blast radius of each change.**

## Rollout strategy for a legacy codebase

1. **Pick the crown jewels.** Identify the modules where a silent bug is catastrophic. For a
   billing/payments system, for example: money **calculation**, the scheduled **batch-run**
   orchestration, **payment idempotency** (a unique reference), **due-date** rules, money
   rounding (`decimal(18,2)`).
2. **Baseline them.** Run mutation once on those modules. The survivor list _is_ your
   test-hardening backlog — prioritized by risk, handed to you (or the agent) for free.
3. **Turn on the diff gate** (`--since` / `--diff`) in CI for those modules at L2 thresholds.
4. **Add properties to the math.** Invariants over generated inputs ("paid ≤ owed", "rounding
   conserves cents", "due date always lands on the configured business day") catch the classes of bug examples
   miss.
5. **Quarantine flakes ruthlessly.** A flaky gate is no gate. Time-dependent logic
   (`DateTime.Now`, a scheduled-date calc) is the usual culprit — inject the clock so tests are
   deterministic.
6. **Expand outward** module by module. Track _coverage of the diff_ and _mutation score of the
   diff_ over time, not a repo-wide percentage.
7. **Wire in the AI gauntlet** (Part 5): agent-generated tests must kill a new mutant to merge.

## What "enough tests" finally means

Not a coverage number. **Enough** is when, for the code you're changing:

> there are **no surviving non-equivalent mutants**, the **assertions are behavioural and
> smell-free**, the **critical invariants are properties**, and the **suite is fast and
> flake-free** — so a passing build is genuine evidence the change is safe.

When that holds on a module, you can let the agent change that module and merge on green
without manually testing — because the _measurement_, not the model's confidence, is what's
vouching for the change. That is the full agentic loop, earned rather than assumed.

## One-screen checklist (pin this)

```
PER-PR MERGE-GATE (scoped to the diff)
[ ] Diff coverage ≥ 90%            (Coverlet / go test -cover)
[ ] No coverage zeros on changed/critical lines
[ ] Diff mutation score ≥ 80%      (Stryker --since / gremlins --diff)
[ ] Zero surviving non-equivalent mutants on changed lines
[ ] Smell scan clean (no assertion-free / magic-number / cond-logic / act-assert mismatch)
[ ] Critical paths: property/invariant tests present (FsCheck/CsCheck · gopter/rapid)
[ ] Flakiness ≈ 0 (5× rerun stable); time/network injected, not ambient
[ ] Gate runs in minutes (diff-scoped, baseline/incremental)
[ ] AI-generated tests: each kills ≥1 new mutant; oracle traces to spec, not current code
```

> **The whole series in one line:** coverage tells you what you're blind to; mutation score
> tells you what your tests would actually catch; neither is a silver bullet alone — but scoped
> to the diff, combined, and used as a gate rather than a grade, they're enough to let an agent
> merge on green.

---

### Sources

- Stryker.NET thresholds/flags (defaults `high:80/low:60`):
  https://stryker-mutator.io/docs/stryker-net/configuration/ _(per docs; not independently
  re-verified this run)._
- Diff-based industrial mutation: _State of Mutation Testing at Google_,
  https://research.google/pubs/state-of-mutation-testing-at-google/ _(confirmed 2-1)._
- AI-test gating on mutants not coverage: Meta TestGen-LLM & follow-up,
  https://arxiv.org/abs/2402.09171 · https://arxiv.org/abs/2501.12862.
- Incremental gate starting points (achievable diff thresholds, raise over time): practitioner
  guidance, https://getautonoma.com/blog/quality-gate-vibe-coding.

---

← **Previous:** [Part 5 — Grading AI-Generated Tests](/memo/posts/test-quality-part-5-grading-ai-tests/) · This closes the series.

**The series — Beyond Coverage: Test Quality for the Agentic Loop:** [0 · Why Coverage Lies](/memo/posts/test-quality-part-0-why-coverage-lies/) · [1 · The Metric Catalog](/memo/posts/test-quality-part-1-metric-catalog/) · [2 · Mutation Testing, Properly Explained](/memo/posts/test-quality-part-2-mutation-testing/) · [3 · What the Empirical Research Actually Says](/memo/posts/test-quality-part-3-empirical-evidence/) · [4 · Tooling for Go and .NET](/memo/posts/test-quality-part-4-tooling-go-dotnet/) · [5 · Grading AI-Generated Tests](/memo/posts/test-quality-part-5-grading-ai-tests/) · **6 · The Readiness Rubric (you are here)**
