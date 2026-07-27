---
title: "Freeze, don't hash: giving a non-deterministic agent's findings a deterministic identity"
description: "How a code-review agent inside a multi-agent system gives its findings a stable ID across independent, memoryless runs — the hashing design that silently broke, and the fix borrowed from an architecture-docs tool: freeze one instance of the output as a replayable check, then reconcile by replay, not comparison."
pubDatetime: 2026-07-27T09:00:00Z
lang: en
tags:
  - ai-agents
  - non-determinism
  - deduplication
  - code-review
  - claude-code
  - harness-design
multiLangKey: "freeze-dont-hash-gap-ids"
---

> This grew out of the same **tribe** multi-agent code-review system covered in
> [Campaign Runner: reading a TypeScript orchestrator through C# eyes](/memo/posts/tribe-campaign-runner-orchestrator/)
> — this time about **Tracker**, tribe's rules-review agent, and a problem specific to it: giving
> its findings a stable identity across independent, memoryless review runs. The design that
> finally worked borrows an existing idiom from **C3**, an architecture-documentation tool used in
> the same codebase.

---

## TL;DR

1. **The problem:** Tracker flags undocumented-but-repeated code patterns ("harness gaps") for a
   human to rule on — promote to rule, promote to anti-rule, record as accepted debt, or dismiss.
   Each gap needs one stable ID across PRs so it is reported once, not re-minted every run.
2. **The wrong fix:** `hash(pattern_description + path_scope)`. It silently mints a new ID every
   time the same real issue happens to get described in different words — which is *every time*,
   because each review is a fresh, memoryless LLM call.
3. **The working fix:** don't hash what the model *said* — freeze one instance of what it *did*.
   Mint a sequential ID the first time a gap is seen, and freeze the exact **evidence command**
   the agent happened to write as that gap's permanent fingerprint, in an append-only ledger.
   Reconciliation later **replays** the stored fingerprint against the current diff — a command
   either fires or it doesn't, which is deterministic even though the agent that wrote it wasn't.
4. **Where the idiom came from:** C3 assigns entity identity once, at creation (`c3-215`,
   `rule-no-squash-merge`), and never re-derives it by re-running whatever process created the
   entity. This note applies the same rule to LLM-generated findings.
5. **The generalized lesson:** when a non-deterministic generator produces identity-bearing
   output, don't hash what it produced — capture one instance of it as a frozen, replayable check,
   and answer "is this the same thing again?" by **replay**, not by comparison.

---

## 1. The origin: why a code-review gap needs an identity at all

Tracker is a rules-review agent: on every PR it reads the diff and the repo's *written* rules and
flags violations. Separately, it also looks for a different kind of signal — a **harness gap**: a
code pattern that repeats across the codebase but that no written rule currently governs (e.g. "9
files independently swallow exceptions in a bare `catch {}`"). A harness gap is not a rule
violation (there is no rule yet); it is a *candidate* for a human to decide on:

- **promote to rule** — write it down, enforce it from now on;
- **promote to anti-rule** — write down that this pattern is explicitly forbidden;
- **record as debt** — acknowledged, not fixed yet, tracked;
- **dismiss** — not actually a problem.

Tracker runs on *every* PR, and it has **no memory between runs** — each invocation is a fresh LLM
call with the diff and the rule set as its only input. Without a stable identity, the exact same
real-world gap would be reported fresh on every single PR, forever, because nothing tells the
system "you already saw this." A human ruling on a gap once needs that ruling to stick.

So the actual requirement is narrow and mechanical: **given a candidate gap found on PR N, and the
possibility that the same real gap surfaces again on PR N+3 from a completely independent review
run, decide whether they are the same gap — deterministically** — so a downstream count (e.g. "how
many gaps did Tracker correctly re-recognize vs. wrongly re-mint," a precision-style metric) means
something.

## 2. The wrong design: hashing the agent's prose

The first design looked reasonable on paper: give each gap an ID computed from its description.

```
gap_id = hash(pattern_description + path_scope)
```

This works if the same input always produces the same description. It doesn't, because Tracker's
"input" is not a fixed function call — it's an LLM completion. Concretely, two independent Tracker
runs over the identical underlying code produced:

| Run | Description | Evidence command |
|---|---|---|
| PR #61 | "handlers swallow errors in a bare catch" | `grep -rn 'catch {}' src/handlers/` |
| PR #64 | "empty catch blocks discard exceptions in handler modules" | `grep -rn 'catch\s*{\s*}' src/handlers/` |

Same real code. Same real problem. Two different sentences, two different regexes, and therefore
**two different hashes**. `hash()` has no way to know these describe one thing — hashing is
*supposed* to be sensitive to every character of its input, and prose from a fresh LLM call is
exactly the kind of input that varies in ways that carry no meaning.

The failure mode this produces is the dangerous kind: **silent**. Nothing crashes. Nothing errors.
The system just quietly mints `G-014` for a gap that is actually `G-002` seen four PRs ago, and
every downstream count that assumed "one gap = one ID" is now wrong with no visible symptom. A
precision metric computed on top of this ledger — "of N reported gaps, how many were real
re-detections vs. duplicates" — is corrupted from underneath, and there is no error message telling
anyone to go check it.

## 3. The fix: borrow C3's identity idiom

The fix came from noticing that this codebase already solves an adjacent problem with a rule worth
copying. **C3** is an architecture-documentation system used in this repo: every entity it manages
— a component, a rule, an architecture-decision record — gets an ID **once, at creation**
(`c3-215`, `rule-no-squash-merge`), and that ID is **frozen forever**. Crucially, C3 never
*re-derives* an entity's ID by re-running whatever process created it (re-summarizing the
component, re-describing the rule). The ID is a pointer assigned at birth, not a hash of the
entity's current description.

Applied to Tracker's gaps, the same rule reads:

1. **Mint identity once.** The first time a gap is seen, give it the next sequential ID:
   `G-001`, `G-002`, … Never re-derive it later.
2. **Freeze the evidence command, not the description.** The exact command the agent happened to
   write to demonstrate the gap — the literal `grep -rn 'catch {}' src/handlers/` from PR #61 — is
   captured *verbatim* and stored as that gap's permanent fingerprint, in an **append-only ledger**
   (one JSON object per line, JSONL, so history is a diff-friendly audit trail, never overwritten).
3. **Reconcile by replay, not by comparison.** On every later run, a new candidate gap is matched
   against the ledger's *open* entries not by comparing its description to old descriptions, but
   by **re-executing every stored fingerprint against the current diff/files**. A shell command
   either produces output or it doesn't — that is deterministic, regardless of whether the LLM that
   originally wrote the command was deterministic.

This is the crux of the whole idea, stated once, generally:

> **When a non-deterministic generator (an LLM) produces identity-bearing output, don't hash what
> it produced — capture ONE instance of it as a frozen, replayable check, and use REPLAY, not
> comparison, to answer "is this the same thing again?"**

Hashing asks "do these two descriptions look the same?" — a question prose answers unreliably.
Replay asks "does this frozen probe still fire?" — a question a shell exit code answers exactly
the same way every time.

## 4. Worked example — three PRs, one ledger

**Step 1 — PR #61, registry empty.** Tracker reports a candidate gap: 9 of 9 files in
`src/handlers/` hit by `grep -rn 'catch {}' src/handlers/`. No fingerprint in the ledger matches
(the ledger is empty) → mint `G-001`, freeze this exact grep as its fingerprint:

```json
{"id":"G-001","event":"opened","category":"error-handling","paths":["src/handlers/"],"fingerprint":"grep -rn 'catch {}' src/handlers/","hits_at_detection":9,"first_seen_pr":61}
```

**Step 2 — PR #64, same real issue, a completely independent Tracker session.** The fresh LLM call
describes the same underlying pattern in different words ("empty catch blocks discard exceptions
in handler modules") and writes a different regex to demonstrate it. Reconciliation does not read
this description at all — it takes `G-001`'s *stored* fingerprint and re-runs it against the
current diff's files. It still fires (now 10 hits, one new file added the pattern) → this is
recognized as the same gap. Only an append line is written, no new ID:

```json
{"id":"G-001","event":"seen","pr":64,"hits_now":10}
```

**Step 3 — PR #67, a human rules on it.** A person reviewing the gap promotes it: from now on,
bare `catch {}` in handlers is an explicit anti-rule. The ledger records the disposition, and
because the gap is now enforced by a real, written rule, it is suppressed from future reports:

```json
{"id":"G-001","event":"ruled","disposition":"anti-rule","ref":"rule-no-bare-catch"}
```

Three PRs, one identity, one line of ledger per event, zero re-reading of anyone's prose to decide
"is this the same gap."

## 5. Honest edge case: what happens when a fingerprint goes stale

This design is not failure-free — it is *safely* imperfect, which is the point. If the underlying
code changes enough (say, the handlers get refactored so no file matches `catch {}` verbatim
anymore, even though a structurally identical bug still exists in a different shape), the stored
fingerprint for `G-001` stops firing. Reconciliation then fails to match the next occurrence of the
real problem, and a **new** ID gets minted for what is, in truth, the same underlying gap —
`G-014`, say, sitting right next to `G-001` in the next report.

That is a real cost — a spurious duplicate ID — but compare its *shape* to the hash design's
failure: this one is **visible**. A human looking at that PR's report sees two structurally similar
gaps show up in the same review and can mark one a duplicate of the other by hand, and a precision
metric can exclude known-duplicate pairs from its count. The hash-based design's failure was
silent — nothing ever pointed at it. A stale fingerprint is a bounded, legible failure mode; a
non-reproducible hash is an invisible one. Between "sometimes double-counts, but a human can see
and correct it" and "silently corrupts a metric with no symptom," the former is the only one worth
shipping.

## 6. Generalizing beyond Tracker

Nothing about this technique is specific to catch blocks, Tracker, or tribe. It generalizes to
**any pipeline where an LLM agent produces findings/issues across independent, non-deterministic
runs, and something downstream needs to know whether run N+1's finding is "the same" as run N's**:
flaky-test triage bots, security-scanning agents, "review the architecture" agents, LLM-as-judge
pipelines that track recurring failure modes — any place a fresh model call is asked to notice
something that was already noticed before.

The rule to carry away: **identity for a non-deterministic generator's output is not a property of
the output's content — it is a decision, made once, and frozen.** If the generator can also emit a
*mechanical, replayable probe* for what it noticed (a grep, a test, a query, a lint rule), freeze
that probe as the fingerprint and reconcile by replaying it. If it can't, you're stuck comparing
prose — and prose comparison will always be a similarity judgment, never an identity check.

## Sources & related reading

- Internal: a private `tribe` multi-agent code-review system (Tracker, Warchief, Hunter, Skinner)
  and the harness-gap detector design this post distills — cited for provenance only.
- On this blog: [Campaign Runner: reading a TypeScript orchestrator through C# eyes](/memo/posts/tribe-campaign-runner-orchestrator/)
  — the deep dive on tribe's orchestrator, the module that spawns and supervises the executor
  sessions Tracker and its siblings run inside.
- On this blog (Vietnamese, Southern-dialect narrative): [Bun port 1 triệu dòng code trong 11 ngày — và cái plugin tui viết vì hết tin nổi chữ "done"](/memo/posts/tribe-plugin-va-cau-chuyen-bun-migrate/)
  — the origin story of the whole tribe design, including why Tracker exists at all.
- The identity idiom borrowed here is **C3**'s entity-ID model: identity is assigned once at entity
  creation and never re-derived from re-running the process that produced the entity — the same
  pattern applied to architecture docs instead of agent findings.
