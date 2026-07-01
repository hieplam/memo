---
title: "Beyond Coverage, Part 1: The Test-Quality Metric Catalog"
description: "A field guide to test-quality metrics organized as four layers — reachability, effectiveness, risk targeting, and trust — with the oracle-strength layer, not coverage, deciding whether a suite is actually good."
pubDatetime: 2026-07-01T00:05:00Z
lang: en
tags:
  - testing
  - test-quality
  - mutation-testing
  - code-coverage
  - test-smells
multiLangKey: "test-quality-metrics-1"
---

> **"Beyond Coverage: Test Quality for the Agentic Loop" — Part 1 of 7.** There is no single
> "test quality" number — this part lays out the whole catalog as a stack of four layers, each
> answering a different question. Part 0 established why coverage lies; this is the map of what
> to measure instead.

---

## How to think about it: four layers, four questions

| Layer                   | Question it answers                             | Primary metrics                                                            | Indicator type                             |
| ----------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **1 · Reachability**    | Did the test even _run_ this code?              | Line/statement, branch/condition, MC/DC coverage                           | **Negative only** (low = bad; high ⇏ good) |
| **2 · Effectiveness** ★ | Would the test _notice_ if the code were wrong? | **Mutation score**, assertion density & quality, test-smell freedom        | **Positive** — this is "good"              |
| **3 · Risk targeting**  | Are the _changed_ and _critical_ parts tested?  | Diff/changed-line coverage, critical-path coverage, property-based testing | Positive (scoped)                          |
| **4 · Trust & health**  | Is the signal reliable enough to gate a merge?  | Flakiness rate, suite speed, determinism, pass-on-rerun                    | Gate prerequisite                          |

![The test-quality metric stack: four layers, each answering a different question about the suite](/memo/diagrams/test-quality-metrics/03-metric-stack.svg)
_No single number is "test quality." Read the suite as four layers, and gate bottom-anchored._

You build **up** the stack and you gate **bottom-anchored**: fix the coverage zeros, then prove
oracle strength, then aim it at the diff and critical paths, and only trust it to gate merges
once it's reliable.

## Layer 1 — Reachability (coverage family)

- **Line / statement coverage** — % of statements executed. Coarsest. Easiest to game.
- **Branch / condition coverage** — % of decision outcomes (true _and_ false) executed. Stronger
  than line, still execution-only. Recall: it agrees with mutation on only ~47% of classes
  (Part 0).
- **MC/DC (Modified Condition/Decision Coverage)** — each boolean sub-condition independently
  shown to affect the outcome. Mandated in safety-critical avionics (DO-178C). Strong
  structurally, but _still_ answers only "was this exercised?", not "would a wrong result be
  caught?"

**Use:** negative indicator + the denominator that tells mutation tools where it's even worth
placing mutants.

## Layer 2 — Effectiveness (the oracle layer) ★

This is the heart. These metrics measure whether the **assertions** can catch a regression.

- **Mutation score** — inject small faults ("mutants") into the code; the score is the % the
  test suite _kills_ (detects via a failing test). This is the most direct proxy for "would my
  tests catch a bug here?" Full treatment in **Part 2**. Note the honest nuance: mutation score
  is a powerful **diagnostic of oracle strength**, but _not_ a magic standalone predictor of
  real-world faults — see **Part 3**.
- **Assertion density** — assertions per test. A blunt but useful smoke alarm: a test with
  **zero** assertions verifies nothing (an _Assertion-Free Test_ smell), yet still counts toward
  coverage. Density alone is gameable (you can add weak asserts), so pair it with mutation
  score.
- **Assertion _quality_** — do assertions check _behaviour_ (the intended output/contract) or
  _implementation_ (incidental internals)? A _strong_ oracle "detects deviations from intended
  program behaviour"; correctness (no false alarms) and strength are **orthogonal** — a correct
  oracle can still be weak. <sup>[oracle]</sup>
- **Test-smell freedom** — absence of the well-catalogued smells that quietly destroy
  fault-detection:
  - _Assertion-Free Test_ / _Empty Test_ — no verification. An empty test is "more dangerous
    than not having a test at all" because the framework reports it as **passing**.
    <sup>[smells]</sup>
  - _Test Tautology_ — assertions logically predetermined to pass.
  - _Assertion Roulette_ — many unlabeled asserts; on failure you can't tell which broke.
  - _Eager Test_ — one test exercises many behaviours, so a failure is ambiguous.
  - _Mystery Guest_ / _Magic Number Test_ / _Conditional Test Logic_ / _Sleepy Test_ (arbitrary
    `sleep`). The canonical catalog lists ~19 types. <sup>[smells]</sup>

## Layer 3 — Risk targeting

Effectiveness is expensive; spend it where it matters.

- **Diff / changed-line coverage** — of the lines this PR changed, how many are tested? The
  single most practical day-to-day gate, and the natural unit for a legacy codebase (you don't
  need the whole repo green — just the diff).
- **Critical-path coverage** — explicit, high-strength testing of money/auth/data-loss paths. In
  a typical fintech domain: money calculation, a scheduled payment run, idempotency,
  due-date rules.
- **Property-based testing** — instead of fixed examples, assert _invariants_ over generated
  inputs (Go: `testing/quick`, `gopter`, `rapid`; .NET: `FsCheck`, `CsCheck`). A strong quality
  signal because it forces you to state _what must always be true_, and it explores inputs you'd
  never hand-pick. Excellent for money math: "total paid never exceeds amount owed," "rounding
  never loses a cent."

## Layer 4 — Trust & health

A suite can be effective and still untrustworthy as a gate.

- **Flakiness rate** — % of tests with non-deterministic pass/fail. A flaky gate is _no gate_:
  it trains humans (and agents) to retry until green, which silently disables the protection.
  Meta's pipeline explicitly re-runs candidate tests **5×** and discards any that aren't stable.
  <sup>[testgen]</sup>
- **Suite speed / health** — if the gate takes hours, it won't run on every PR. Diff-scoped runs
  keep it in minutes.
- **Determinism** — no dependence on wall-clock, ordering, network, or shared state. (Directly
  relevant to any `DateTime.Now` / due-date logic — ambient time is the classic flakiness
  source.)

## What this means for "did I write enough tests?"

Stop asking "what's my coverage %?" Ask, per module, in this order:

1. **Are there coverage zeros on changed/critical code?** (Layer 1 — cheap to find.)
2. **Do surviving mutants exist on those lines?** i.e., can I break the code and have tests
   still pass? (Layer 2 — the real answer.)
3. **Are the assertions behavioural, and free of smells?** (Layer 2.)
4. **Is the diff and the money-path covered with strong oracles?** (Layer 3.)
5. **Is the suite fast and flake-free enough to trust unattended?** (Layer 4.)

A "good enough" legacy suite is one where, for the code you're changing, the answers are _no
zeros, few survivors, behavioural asserts, no flakes_. That is the precondition for the agentic
loop — quantified in Part 6.

The layer that decides "good," Layer 2, deserves its own close look. Mutation score is the
sharpest instrument we have for it, and Part 2 is a proper explanation of how it actually works.

---

### Sources

- **[smells]** testsmells.org catalog & test-smell catalog.
  https://testsmells.org/pages/testsmells.html ·
  https://test-smell-catalog.readthedocs.io/en/latest/
- **[oracle]** _Test oracle strength vs. correctness_ (orthogonality), arXiv 2405.x.
  https://arxiv.org/html/2405.03786
- **[testgen]** Alshahwan et al., _Automated Unit Test Improvement using LLMs at Meta
  (TestGen-LLM)_, FSE 2024. https://arxiv.org/abs/2402.09171
- **[oraclegap]/[branchcov]** see Part 0 sources.

---

← **Previous:** [Part 0 — Why Coverage Lies](/memo/posts/test-quality-part-0-why-coverage-lies/) · **Next:** [Part 2 — Mutation Testing, Properly Explained](/memo/posts/test-quality-part-2-mutation-testing/) →

**The series — Beyond Coverage: Test Quality for the Agentic Loop:** [0 · Why Coverage Lies](/memo/posts/test-quality-part-0-why-coverage-lies/) · **1 · The Metric Catalog (you are here)** · [2 · Mutation Testing, Properly Explained](/memo/posts/test-quality-part-2-mutation-testing/) · [3 · What the Empirical Research Actually Says](/memo/posts/test-quality-part-3-empirical-evidence/) · [4 · Tooling for Go and .NET](/memo/posts/test-quality-part-4-tooling-go-dotnet/) · [5 · Grading AI-Generated Tests](/memo/posts/test-quality-part-5-grading-ai-tests/) · [6 · The Readiness Rubric](/memo/posts/test-quality-part-6-readiness-rubric/)
