---
title: "Trunk-Based Development vs 'Release-Please': Three Problems Teams Mistake for One"
description: "Teams hit by staging contention and 'lost code on merge' often reach for a release-branch + cherry-pick scheme they call 'release-please'. This untangles three problems mistaken for one, fact-checks what release-please actually does, shows why cherry-pick-to-curate reproduces the very bug it is meant to fix, and lays out a generic trunk-based playbook."
pubDatetime: 2026-07-01T09:00:00Z
lang: en
tags:
  - trunk-based-development
  - release-please
  - cherry-pick
  - feature-flags
  - staging-environments
  - git
  - ci-cd
multiLangKey: "trunk-based-vs-release-please"
---

## TL;DR

1. **Three problems wear one mask.** *"We fight over staging"*, *"merging is exhausting / code gets lost"*, and *"how do we choose what ships"* are **three different problems with three different fixes**. Choosing a branching strategy to solve all three at once is the original mistake.
2. **"Release-please" is not what most people think.** The real tool (`googleapis/release-please`) **never cherry-picks and never curates a release branch**. It watches your trunk and automates version + changelog + tag. It is automation *on top of* trunk-based development — the **opposite** of "cut a release branch and cherry-pick the commits you want."
3. **Cherry-picking to curate a release is self-defeating.** It re-creates the exact "lost code" bug you are fleeing — and makes it **silent**. A forgotten or mis-ordered cherry-pick compiles, passes isolated tests, and ships; the gap surfaces weeks later as a "regression." Trading a *loud* failure (merge conflicts) for a *quiet* one (silent drops) is a bad deal — doubly so for money-handling code.
4. **Staging contention is an environment problem, not a branching one.** `contention = (people needing isolated validation) ÷ (usable staging targets)`. No branching model changes that ratio. Ephemeral environments, per-user feature-flag targeting, or a booking queue do.
5. **Verdict.** Between the two options as usually framed, **trunk-based development wins decisively** on the merge/lost-code axis and ties (at zero) on staging. But it is a **false binary** — release-please rides *on* trunk-based development. Adopt trunk-based as the branching discipline, use **feature flags + a release-train snapshot** (no cherry-pick curation) to control what ships, and solve staging **separately** with an environment strategy.

---

## 1. The scenario (anonymised)

A team ships a service with **one shared staging environment**. Many developers build features at the same time, and every feature must be validated on that single environment — so they **contend** over who gets to deploy to staging.

They have tried two workarounds:

- **A shared integration branch.** Everyone's in-progress work is merged into one branch, deployed to staging, and — once a feature passes — merged onward to `master`; the integration branch is periodically re-synced by merging `master` back into it. The pain: the constant, two-way merging is **exhausting**.
- **Always merge straight to `master`.** They dropped the integration branch. New pain: on merges, changes get **"missed" / lost** — code silently disappears.

Their proposed idea, which they call **"release-please"**: always merge to `master`; when it is time to release, **cut a dedicated release branch and cherry-pick the desired commits into it**, then release from there.

The rest of this note argues that this framing conflates three problems, that the "release-please" label is factually wrong, and that the cherry-pick plan re-introduces the very bug it is meant to solve — while laying out what actually fixes each problem.

## 2. Three problems, not one

This is the crux. Untangle them and each has a distinct, well-understood fix:

| Problem | What it really is | The right class of fix |
| --- | --- | --- |
| Fighting over one staging env | **Environment / resource** topology | Ephemeral envs, feature-flag targeting, booking/lock |
| Merging is exhausting + lost code | **Integration / git hygiene** | Trunk-based: short-lived branches, small one-directional merges |
| Deciding what goes to production | **Release management** | Feature flags / release train / release-please (the tool) |

The staging problem is governed by a ratio:

```
contention = (people who need isolated validation) ÷ (usable staging targets)
           = N ÷ 1    ← today
```

Changing how commits reach `master` **does not touch the denominator**. Keep the exact current workflow but add a second staging target and contention drops. Switch to pure trunk-based development but keep one staging target and contention is *identical* (arguably worse: more frequent, smaller merges each want a validation slot). The fix lives in **environment topology, not version-control topology**.

## 3. What "release-please" actually is (myth-bust)

Fact-checked against the official repository (`googleapis/release-please`, `README.md` + `docs/design.md`):

- It **watches a single branch — normally the default/trunk branch.**
- It parses **Conventional Commits** since the last release tag and maintains **one rolling "Release PR"** *on that same branch* that bumps the version and updates `CHANGELOG.md`. **Merging that PR is the release** (tag + release notes).
- It **recommends squash-merge / linear history** and works poorly with tangled merge commits.
- It assumes **every commit that reaches trunk is already release-worthy.** There is **no cherry-pick and no curated release branch anywhere in its design** — not even in its opt-in maintenance/LTS mode, where a human (or a separate backport bot), not release-please, moves commits.

So release-please is **automation layered on trunk-based development**, not an alternative to it, and the polar opposite of "cut a release branch and hand-pick commits."

What the scenario actually describes has a real, older name: **Fowler's "Release Branch"** pattern / **trunk-based development's "Branch For Release."** Borrowing the name "release-please" for a cherry-pick workflow is not a harmless mislabel — it lends the credibility of a well-designed tool to a pattern that behaves the opposite way, and it will confuse anyone who later adopts the real tool expecting curation.

## 4. Why cherry-pick-to-curate reproduces "lost code"

The central charge. Cherry-picking a curated subset of commits onto a release branch **does not remove** the "lost code on merge" failure — it **relocates** it to a new, more dangerous seam and **strips git's ability to detect it**.

Mechanism (from git docs, Raymond Chen's *"Stop cherry-picking, start merging,"* and the Branch-For-Release literature):

1. **Cherry-pick creates a new commit with a new SHA and no ancestry link** to the original. Git therefore **cannot answer "has this already been ported?"** — that bookkeeping becomes 100% human memory (a SHA list, a changelog, tribal knowledge). Exactly the tracking that fails under release-day pressure → **forgotten cherry-picks → a "fixed" bug ships again weeks later.**
2. **Dependency-order hazard.** Pick commit *B* but forget *A* it depends on, and *B* can apply with **zero textual conflict**, compile, and pass isolated tests — yet be semantically broken in the release context. No conflict marker warns you.
3. **Silent hunk loss.** Resolving a cherry-pick conflict has **no shared merge-base** to sanity-check against, and it is redone from scratch every release. Raymond Chen calls the *no-conflict* case **"even worse"** than a loud conflict — because nobody notices code vanished.

**Loud vs silent is the killer.** Today's pain ("merging is exhausting") is a **loud** failure: a conflict blocks you and everyone sees it. The cherry-pick plan swaps it for a **silent** failure: a dropped commit ships and is discovered weeks later. For money-handling code (idempotency, correctness invariants) a silently dropped change is **strictly worse** than a loud conflict. And it **scales the wrong way**: with many concurrent features, the curated set per release grows, so the error surface grows *as the team grows*.

## 5. The instinct isn't all wrong (steelman)

Be fair — parts of the idea are correct:

- **"Always merge to `master`" (one direction) is right.** The worst offender for lost code is **bidirectional** merging between long-lived branches (features into an integration branch, `master` back into it, repeatedly) — the setup for stale merge-bases and "evil merges." Going one-directional to `master` kills that mechanism. Keep this half.
- **Release branches are legitimate — for the right job:** isolating a hotfix, supporting multiple production versions at once, or a scheduled/regulated release gate. Just **not** as the everyday mechanism for choosing which of many concurrent features ships.
- **The scepticism that "a branching change fixes staging" is correct** — and trunk-based development does not fix it either.

The fix for "control what ships" in trunk-based development is **feature flags** (a runtime decision), not **git-history curation** (a silent-failure-prone decision).

## 6. Trunk-based development is not a silver bullet

If someone says "just adopt trunk-based development," that is **necessary-but-insufficient** advice. It cures **one** of the three problems (integration/lost-code) and demands prerequisites:

1. **A CI gate strong enough to block merges** (compile + fast unit + integration tests). *Skipping this is exactly how "always merge to master" produced lost code the first time — that was trunk-based development's central mechanic without its safety net.*
2. **Feature-flag infrastructure + discipline** to merge incomplete work safely. Flags carry their own risk class: a single stale/dormant flag path once cost a trading firm **~$460M in 45 minutes.** In money-handling systems, audit flags around idempotency/locking deliberately.
3. **Fast code review** (branches live hours–days, not weeks) or "short-lived" branches quietly become long-lived and the merge pain returns.
4. **A small-PR culture** across all contributors.

Also: **DORA's trunk-based correlation is a *bundle*** (trunk-based + automated tests + a reliable deploy pipeline + small batches), **not a lone lever**. Adopt the branching half without the testing/pipeline half and you get the exposure without the benefit.

## 7. Staging contention = environment problem (the ladder)

Treat "an isolated environment per change" as an **interface**, then pick an implementation by budget. All of these are **stack-agnostic**:

| Tier | Pattern | Cost | Actually reduces contention? | Notes |
| --- | --- | --- | --- | --- |
| 0 | **Booking / lock queue** (CD concurrency group; a "who holds staging" bot) | very low | ❌ only makes it fair | every CD system has a concurrency/lock primitive |
| 1 | **Feature-flag targeting** (many features coexist in one env; each tester sees their own state) | low–med | ✅ *if* flags support per-user/session targeting | a global on/off flag does **not** reduce contention |
| 2 | **Shift-left** (real dependencies in CI, e.g. containerised DB/queue) → need staging less | med | ✅ indirectly (less demand) | reduces how much *must* hit shared staging |
| 3 | **Ephemeral per-PR environment** (each PR gets an isolated stack) | high, scales with statefulness | ✅ the real structural fix | cost driver = DB seed + queue isolation + config isolation |
| 3b | **Request-level isolation** (one baseline + route by header) | high up-front, cheap per-PR | ✅ good for heavily-stateful systems | avoids cloning datastores per PR |

**Decision rule:** start at tiers 0+1 immediately (stop the bleeding), invest in tier 2 in parallel, move to 3/3b as ROI becomes clear. **Warning:** ephemeral environments *decay* without an owner and automated seed data — teams lose trust and quietly revert to shared staging. Tier 3 needs a seed pipeline and TTLs, or don't bother.

## 8. The generic playbook

### Target model (any stack)

```
  ┌─ short-lived branch (hours→1-2 days, one owner)
  │     │  PR + CI gate (must be green) + fast review
  ▼     ▼
main (trunk) ───────────────────────────────►  ALWAYS releasable
  │   ▲  unfinished work hidden behind a FEATURE FLAG (not held on a branch)
  │   └── small, frequent, ONE-DIRECTIONAL merges; no long-lived two-way sync
  │
  ├──► Release = deploy/tag trunk on cadence   ← simplest default
  │        (release-please auto-generates tag + CHANGELOG, optional)
  │
  └──► Only if a repo truly needs a stabilisation gate → "release train":
           cut release/<date> = an UNMODIFIED SNAPSHOT of trunk (no cherry-pick curation)
           hotfix = fix on trunk first → cherry-pick -x FORWARD onto the snapshot (isolated, tracked)
           anything not flag-ready simply rides the next train
```

### Three non-negotiable rules

1. **Short-lived branches, merged one-directionally into trunk.** No shared integration branch, no two-way resync.
2. **"What ships" is decided by feature flags (runtime), not by curating git history.** Retire code-freeze branches and cherry-pick-to-select-features.
3. **Cherry-pick only for isolated hotfixes, one direction (trunk → release), tagged `-x`.** Never to curate a release.

### Migration sequence (per repo)

- **Now:** turn on `git rerere` (auto-replay conflict resolutions); require PR + green CI to merge (branch protection). Near-zero cost, immediate lost-code protection.
- **Then:** stop bidirectional merges; cap branch life at ~2 days; dismantle the shared integration branch.
- **Then:** replace code-freeze with a **release train** (snapshot, no curation); hotfix via forward `cherry-pick -x`.
- **In parallel:** feature flags (prefer per-user targeting — it also unlocks staging tier 1); audit flags around money/locking code.
- **Optional:** add release-please for tags + changelog (release *from trunk*).

### Rolling out across many repos

Do not re-solve per repo. Package the model as **shared capability**: shared CI/CD pipeline templates every repo extends; org-wide branch-protection defaults in one config; a shared **feature-flag** platform and a shared **preview-environment** platform (this is where staging is solved *once* for everyone); and a **golden-path repo template** new repos clone.

## 9. Verdict

- **Between the two options as framed → trunk-based development, decisively.** It wins on merge/lost-code and ties (at zero) on staging. The cherry-pick plan is *dominated*: no better on staging, meaningfully worse on the axis it engages, and silent where the current pain is loud.
- **But it is not either/or.** Release-please rides on trunk-based development. The real design is layered: **trunk-based** for branching, **feature flags + release-train snapshot** for what-ships, **an environment strategy** for staging, and **release-please (the tool, from trunk)** for release bookkeeping. The "always merge to master" instinct is right; the "cherry-pick to curate" instinct is the part to drop.

## Sources

- Trunk Based Development — trunkbaseddevelopment.com (esp. *Short-Lived Feature Branches*, *Branch For Release*, *Feature Flags*)
- DORA / Accelerate — *Trunk-based development* capability (dora.dev)
- Martin Fowler — *Patterns for Managing Source Code Branches* (Release Branch pattern)
- Raymond Chen — *Stop cherry-picking, start merging* (The Old New Thing, Microsoft)
- `git-cherry-pick` docs; git *evil merge* glossary; *reoccurring conflicts after squash-merge* write-ups
- `googleapis/release-please` — `README.md`, `docs/design.md`; Conventional Commits v1.0.0
- Ephemeral/preview environments & feature-flag targeting — vendor-neutral write-ups (preview environments, request isolation); feature-flag debt / the ~$460M stale-flag incident
