---
title: "Beyond Coverage, Part 5: Grading AI-Generated Tests"
description: "Raw LLM-generated tests are roughly half junk, and the ones that pass carry a unique danger: they tend to assert what the code currently does, locking in bugs. Here's the six-gate gauntlet that filters them before they merge."
pubDatetime: 2026-07-01T00:05:00Z
lang: en
tags:
  - testing
  - ai-agents
  - llm
  - mutation-testing
  - test-quality
  - agentic-ai
multiLangKey: "test-quality-metrics-5"
---

> **"Beyond Coverage: Test Quality for the Agentic Loop" — Part 5 of 7.** This is the part the
> whole series has been building toward: how to grade a test an AI wrote, so a merge gate can
> trust it without a human re-checking every case by hand.

Raw LLM-generated tests are **roughly half junk** (compile failures, flakes, vacuous asserts),
and the ones that look fine carry a unique danger: they tend to assert _what the code currently
does_ — **locking in existing bugs**. The fix is a **filter gauntlet** modeled on Meta's
TestGen-LLM: a test is admitted only if it **builds, passes, is stable, and kills a mutant no
existing test killed** — and behaviour-defining oracles on critical paths are owned by a
spec/human, not the model.

---

## How bad is raw LLM test output?

Meta's TestGen-LLM (the most authoritative industrial data point) measured its _own_ raw
output: only **75% of generated test cases built correctly, and only 57% passed reliably.**
<sup>[testgen]</sup> Nearly half of raw output is non-functional before you even ask whether it
tests anything meaningful.

And the survivors have characteristic defects:

- **Magic Number Test smell is near-universal** in LLM-generated suites — present in
  **99.78–100%** of class-level suites across GPT-3.5, GPT-4, Mistral 7B, and Mixtral 8×7B.
  <sup>[smellsllm]</sup>
- Auto-generated tests exhibit **13 categories of test smell** uncommon in human tests, grouped
  into _Act-Assert Mismatch_ (e.g. unasserted side effects / return values), _Redundant Code_,
  _Failed Setup_, and _Testing Only Field Accessors/Constants._ <sup>[autosmells]</sup>

So "the AI wrote tests and coverage went up" is _not_ evidence of safety. It may be evidence of
vacuous tests that execute code and assert nothing — the exact Goodhart failure from Part 0.

## The unique danger: bug-locking oracles

This is the one that will bite an autonomous loop hardest. LLMs generating test **oracles**
(the assertions) are _"biased toward the actual (possibly buggy) implementation rather than the
intended behaviour"_ — their oracle-classification accuracy _"considerably drops in the
presence of buggy code."_ <sup>[bias]</sup>

Concretely: point an LLM at a function that computes commission slightly wrong, and it will
happily write `Assert.Equal(wrongValue, result)` — a test that **passes, raises coverage, and
permanently cements the bug.** Worse, every future correct change now "breaks a test," so the
agent (or a tired human) will tend to _update the test to match the buggy code_ rather than fix
the code.

The defense: **the oracle for behaviour that matters must come from the specification, not the
current code.** On critical paths, a human (or a spec/property the human wrote) defines what's
correct; the AI may write the scaffolding and edge cases, but it does not get to _define truth_
for money/auth/data-loss logic.

## Why you must NOT gate AI tests on coverage

The instinct is "accept the AI test if it raises coverage." The data says that throws away your
best tests. In Meta's mutation-guided runs, of **571 tests that caught faults missed by every
existing test, 277 (~half) added zero new line coverage.** A coverage-gated pipeline would have
_discarded half of the genuinely fault-finding tests._ <sup>[coverage-discard]</sup>

> **Gate AI tests on mutants killed, not on coverage gained.** A test that kills a
> previously-surviving mutant is provably strengthening your oracle. A test that only adds
> coverage is, at best, reachability — and at worst, vacuous.

## The grading gauntlet (use this as your accept/reject pipeline)

A machine-generated test is admitted to the suite **only if it clears every gate**:

| #   | Gate                   | Reject if…                       | How                                                                                   |
| --- | ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | **Builds**             | won't compile                    | CI build                                                                              |
| 2   | **Passes**             | red on first run                 | run once                                                                              |
| 3   | **Stable**             | flaky                            | run **5×**, require identical result <sup>[testgen]</sup>                             |
| 4   | **Strengthens** ★      | kills no new mutant              | run mutation on the diff; require ≥1 newly-killed mutant                              |
| 5   | **Clean**              | has a test smell                 | scan: no assertion-free / magic-number / conditional-logic / act-assert-mismatch      |
| 6   | **Behavioural oracle** | asserts implementation, not spec | on critical paths, oracle traces to a human-owned spec/property, not "current output" |

![The AI-generated-test gauntlet: six gates a candidate test must clear before it merges](/memo/diagrams/test-quality-metrics/04-ai-test-gauntlet.svg)
_Never trust raw LLM output. Only a test that survives every filter earns a place in the suite (after Meta's TestGen-LLM, FSE 2024)._

Gates 1–3 are Meta's published filter (build → pass → no-flake). **Gate 4 is the one most teams
skip and the one that actually separates a real test from a vacuous one.** Gates 5–6 defend
against the AI-specific failure modes above.

This is the operational meaning of _"Assured LLM-based Software Engineering"_: never trust raw
model output — keep only changes whose value is **mechanically measured**.

## What this gets you toward the full loop

The goal is to _trust AI-generated tests enough to skip manual testing before merge._ That is
achievable, but the trust is earned by the **gauntlet**, not by the model:

- The agent generates tests freely.
- The gauntlet (gates 1–6) runs in CI, deterministically.
- Only mutant-killing, smell-free, spec-anchored tests merge.
- Surviving mutants on the diff that _nothing_ kills → the gate **blocks the merge** and tells
  the agent exactly what to test next.

In this design you're not trusting the AI's judgment — you're trusting a **measurement** the AI
has to satisfy. That's the difference between "vibe-merging" and an autonomous loop you can
defend. The final part turns this into concrete thresholds and a maturity ladder.

---

### Sources

- **[testgen]** Alshahwan et al., _Automated Unit Test Improvement using LLMs at Meta
  (TestGen-LLM)_, FSE 2024. https://arxiv.org/abs/2402.09171 — _75%/57% build-pass rates and 5×
  flake filter from the paper._
- **[coverage-discard]** Meta follow-up on mutation-guided LLM test generation (277/571 add no
  coverage). https://arxiv.org/abs/2501.12862
- **[bias]** _LLM test-oracle bias toward buggy implementations._
  https://arxiv.org/abs/2410.10628 · https://arxiv.org/html/2410.21136v1
- **[smellsllm]** _Test smells in LLM-generated unit tests_ (Magic Number Test 99.78–100%).
  https://arxiv.org/html/2410.21136v1
- **[autosmells]** _13 test-smell categories in automatically generated tests._
  https://arxiv.org/html/2405.03786
- _Quotes in this chapter are extracted from the primary sources above; the headline
  TestGen-LLM and oracle-bias findings were the basis of confirmed claims, but several
  per-figure details were not independently re-verified in this run — confirm against the
  papers before quoting externally._

---

← **Previous:** [Part 4 — Tooling for Go and .NET](/memo/posts/test-quality-part-4-tooling-go-dotnet/) · **Next:** [Part 6 — The Readiness Rubric](/memo/posts/test-quality-part-6-readiness-rubric/) →

**The series — Beyond Coverage: Test Quality for the Agentic Loop:** [0 · Why Coverage Lies](/memo/posts/test-quality-part-0-why-coverage-lies/) · [1 · The Metric Catalog](/memo/posts/test-quality-part-1-metric-catalog/) · [2 · Mutation Testing, Properly Explained](/memo/posts/test-quality-part-2-mutation-testing/) · [3 · What the Empirical Research Actually Says](/memo/posts/test-quality-part-3-empirical-evidence/) · [4 · Tooling for Go and .NET](/memo/posts/test-quality-part-4-tooling-go-dotnet/) · **5 · Grading AI-Generated Tests (you are here)** · [6 · The Readiness Rubric](/memo/posts/test-quality-part-6-readiness-rubric/)
