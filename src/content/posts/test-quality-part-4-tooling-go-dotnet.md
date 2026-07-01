---
title: "Beyond Coverage, Part 4: Tooling for Go and .NET"
description: "A concrete tooling map for a legacy Go + .NET codebase — Coverlet and Stryker.NET, go test and gremlins, FsCheck/CsCheck and gopter/rapid — and the diff-scoping discipline that keeps mutation testing fast enough to run on every PR."
pubDatetime: 2026-07-01T00:05:00Z
lang: en
tags:
  - testing
  - mutation-testing
  - dotnet
  - golang
  - tooling
  - ci-cd
multiLangKey: "test-quality-metrics-4"
---

> **"Beyond Coverage: Test Quality for the Agentic Loop" — Part 4 of 7.** The concrete commands
> and flags for putting Parts 0–3 into practice on a Go + .NET stack, plus the one operational
> rule that makes mutation testing tractable on a large legacy codebase: scope it to the diff.

For **.NET**: `coverlet` for coverage (the negative filter), **Stryker.NET** for mutation score
(the oracle diagnostic), `FsCheck`/`CsCheck` for properties. For **Go**: built-in
`go test -cover` + `go-carpet`, **gremlins** (or `go-mutesting`/`ooze`) for mutation,
`gopter`/`rapid` for properties. The non-negotiable trick on a legacy codebase is to run
mutation **diff-scoped and incrementally**, never repo-wide.

> ⚠️ **Source note:** the Stryker.NET flag/threshold details below are drawn from the official
> Stryker documentation. Those specific claims were _queued for adversarial verification but
> errored out_ (session limit) in the underlying research run, so treat them as **"per official
> docs, confirm against your installed version."** The conceptual guidance is solid; pin exact
> flag spellings to your Stryker.NET version.

---

## .NET stack

### Coverage — Coverlet

```bash
dotnet test --collect:"XPlat Code Coverage"          # coverlet.collector
# or for line/branch numbers + thresholds:
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura \
            /p:Threshold=0 /p:ThresholdType=line
```

Use Coverlet output **only** to find changed lines with zero coverage. Feed those to
ReportGenerator for a diff view. Do not set a high `/p:Threshold` as a quality gate — that's the
Goodhart trap from Part 0.

### Mutation — Stryker.NET

```bash
dotnet tool install -g dotnet-stryker
dotnet stryker                       # full run (slow — avoid on legacy repos)
dotnet stryker --since:main          # ONLY mutate files changed since main  ← legacy-friendly
dotnet stryker --with-baseline:main  # incremental: reuse prior results, re-test only affected mutants
dotnet stryker --break-at 80         # FAIL the build if mutation score < 80 (hard gate)
```

Key facts (per official docs):

- **Default thresholds** are `high: 80`, `low: 60`, `break: 0` — scores **< 60 are flagged
  "danger,"** **≥ 80 "good."** That's a reasonable industry baseline for "good enough" on a
  .NET module.
- **`--since:<branch>`** restricts mutation to files changed since a git committish — runs
  proportional to the **diff**, not the repo. This is what makes Stryker tractable on a large
  legacy system.
- **`--with-baseline`** persists previous results and only re-tests mutants affected by changed
  source or changed tests — incremental runs that reuse prior work. Ideal for a per-PR agentic
  gate.
- **`--break-at <score>`** turns mutation score into a CI quality gate.

### Properties — FsCheck / CsCheck

```csharp
// CsCheck — invariant: a commission payment never exceeds the amount owed
Gen.Decimal[0m, 1_000_000m].Sample(owed => {
    var paid = CommissionCalculator.Pay(owed);
    Assert.True(paid <= owed);
});
```

Properties are the highest-value oracle for money math — they assert _what must always be true_
and explore inputs you'd never enumerate.

## Go stack

### Coverage — built-in

```bash
go test ./... -coverprofile=cover.out
go tool cover -func=cover.out          # per-function %
go tool cover -html=cover.out          # visual
go-carpet                              # terminal heatmap of uncovered lines
```

### Mutation — gremlins (recommended), go-mutesting, ooze

```bash
go install github.com/go-gremlins/gremlins/cmd/gremlins@latest
gremlins unleash ./...                 # full run
gremlins unleash --diff main ./...     # diff-scoped (legacy-friendly)
gremlins unleash --dry-run             # list mutants without running tests (estimate cost)
```

gremlins reports two distinct numbers — keep them separate (Part 2):

- **Test Efficacy** = `KILLED / (KILLED + LIVED)` → oracle strength.
- **Mutant Coverage** = `(KILLED + LIVED) / (KILLED + LIVED + NOT_COVERED)` → reachability.

Alternatives: **go-mutesting** (older, broad operator set), **ooze** (library-style, embed in
your own tooling). All share the diff-scoping principle.

### Properties — gopter / rapid / testing/quick

```go
// rapid — invariant: rounding to cents never loses or invents money
rapid.Check(t, func(t *rapid.T) {
    owed := rapid.Float64Range(0, 1e6).Draw(t, "owed")
    paid := commission.Pay(owed)
    require.LessOrEqual(t, paid, owed)
})
```

## The canonical reference: PIT (Java)

When you read about mutation testing maturity, the gold standard is **PIT / Pitest** (Java).
Stryker (`.NET`/JS/Scala) and gremlins (Go) are the spiritual ports. PIT pioneered the practical
moves worth copying: **bytecode mutation for speed, incremental analysis, and coverage-guided
mutant selection** (only mutate covered lines). If you want to understand _why_ a feature
exists in Stryker/gremlins, the PIT docs usually explain it first.

## Running mutation testing on a legacy codebase without it taking all day

This is the make-or-break operational concern. The rules:

1. **Diff-scope everything.** Mutate only files/lines changed in the PR (`--since` / `--diff`).
   Google's industrial practice mutates diff-based and skips "arid" lines (uncovered/
   uninteresting), which _"drastically reduces the number of mutants."_ <sup>[google]</sup>
2. **Mutate only covered lines.** A mutant on an uncovered line is guaranteed to survive and
   tells you nothing new (you already know it's uncovered). Coverage becomes the _input filter_
   to mutation — this is the one genuinely good use of coverage.
3. **Set a time budget.** Cap wall-clock per run (e.g. 10 min). If the diff is huge, sample
   mutants. **Log what you skipped** — never let a silent cap masquerade as "all green."
4. **Use baselines/incremental mode.** Persist results; only re-test mutants affected by the
   change (`--with-baseline`).
5. **Triage equivalents once, suppress forever.** Maintain an ignore-list of known-equivalent
   mutants so they don't re-nag every run.
6. **Start with the crown jewels.** Don't boil the ocean. Turn on diff-mutation for the
   highest-risk modules first — for a payments system, that means: money
   calculation, batch-run orchestration, idempotency/reference uniqueness, due-date rules. Expand
   outward.

With the tools in hand, the next part turns to the hardest audience for all of this: tests an
AI wrote. Coverage and even a naive mutation run can both be gamed by a model that's optimizing
for the wrong signal — Part 5 is the grading gauntlet that catches it.

---

### Sources

- **[stryker]** Stryker.NET configuration & pipeline docs.
  https://stryker-mutator.io/docs/stryker-net/configuration/ ·
  https://stryker-mutator.io/docs/stryker-net/stryker-in-pipeline/ — _flag/threshold specifics
  per docs; not independently re-verified in this run._
- **[gremlins]** go-gremlins. https://github.com/go-gremlins/gremlins · https://gremlins.dev/
- **[google]** _State of Mutation Testing at Google._
  https://research.google/pubs/state-of-mutation-testing-at-google/ — _arid-lines/diff approach
  confirmed (2-1)._
- PIT/Pitest reference: https://pitest.org/

---

← **Previous:** [Part 3 — What the Empirical Research Actually Says](/memo/posts/test-quality-part-3-empirical-evidence/) · **Next:** [Part 5 — Grading AI-Generated Tests](/memo/posts/test-quality-part-5-grading-ai-tests/) →

**The series — Beyond Coverage: Test Quality for the Agentic Loop:** [0 · Why Coverage Lies](/memo/posts/test-quality-part-0-why-coverage-lies/) · [1 · The Metric Catalog](/memo/posts/test-quality-part-1-metric-catalog/) · [2 · Mutation Testing, Properly Explained](/memo/posts/test-quality-part-2-mutation-testing/) · [3 · What the Empirical Research Actually Says](/memo/posts/test-quality-part-3-empirical-evidence/) · **4 · Tooling for Go and .NET (you are here)** · [5 · Grading AI-Generated Tests](/memo/posts/test-quality-part-5-grading-ai-tests/) · [6 · The Readiness Rubric](/memo/posts/test-quality-part-6-readiness-rubric/)
