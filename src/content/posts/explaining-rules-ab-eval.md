---
title: "Don't Ship the Bundle: A/B-Testing Prompt Rules Before You Believe Them"
description: "I pasted a Gemini session's suggestions into my global Claude rules alongside my own favorite line, all at once. Output improved, but I couldn't say why — so I ran a real 30-run A/B eval to find out, and my own favorite line turned out to be the one that didn't matter."
pubDatetime: 2026-07-18T09:00:00Z
lang: en
tags:
  - prompt-engineering
  - evals
  - llm-judge
  - ai-agents
  - claude-code
multiLangKey: "explaining-rules-ab-eval"
---

I write a standing instruction for my LLM sessions with an "Antigoal" clause: every new term must be introduced with context, a direct defense against the **Curse of Knowledge** — the habit LLMs have of writing expert-to-expert and dropping jargon with no lead-in. A Gemini session, asked to review that instruction, suggested restructuring it and argued LLMs follow **affirmative** instructions ("do X") more reliably than **negated** ones ("don't do Y"). I liked the suggestion, pasted it into my global rules along with my own line — and shipped it without testing anything.

That's the mistake this post is about, and how I went back and fixed it with an actual eval.

---

## TL;DR

- A bundle that "works" tells you nothing about **which ingredient** did the work. I pasted a Gemini session's suggestions into my global Claude rules *and* added my own line ("ground claim with truth, code or fact") **all at once**. Output improved — but I couldn't say why. My own hypothesis at the time ("maybe it's the grounding line") turned out to be wrong.
- A follow-up Claude.AI session checked the two literature claims behind the restructuring (affirmative-beats-negated instructions; persona prompting) against primary sources, found both real but dated (2022 / 2024), and designed a proper **A/B kit** instead of shipping more rules on vibes.
- A Claude Code session re-verified all 4 original citations (**all confirmed**), added newer 2025–26 literature the earlier pass didn't have, then ran the actual eval: **5 arms × 3 prompts × 2 reps = 30 runs**, blind-graded by a different model.
- **Result: my own favorite line was inert.** The term-discipline rule (A2) is the active ingredient for undefined-term density (−56% alone); my grounding line (A1) alone did **nothing** for that metric. The pair (A3 = A1+A2) dominates every metric. A fourth candidate rule (reader-model framing, A4) actively **regressed** the main metric and was dropped.
- **Three eval-infrastructure bugs were caught mid-run** (built-in skill contamination, a blind-ID seed collision, an LLM-grader over-count) — each would have silently corrupted the numbers if unnoticed. Only the surviving A3 pair shipped, with its numbers and bounds baked into the skill (`todd-skills` PR #43, plugin `explaining`, merged 2026-07-18).

---

## 1. The itch

I write a prompt for LLM sessions with an "Antigoal" clause: every new term must be introduced with context — a direct defense against the **Curse of Knowledge**, the habit LLMs have of writing expert-to-expert and dropping jargon with no lead-in. A Gemini session, asked to review that prompt, suggested restructuring it into 3 templates (Guidelines + Anti-goals, persona, direct rules), arguing that LLMs follow **affirmative** instructions ("do X") more reliably than **negated** ones ("don't do Y").

## 2. The bundle mistake

I pasted the Gemini suggestions into my global Claude rules **and** added my own line ("ground claim with truth, code or fact") — all in the same edit. Output got better. But which ingredient worked? Unknown — the variables were never isolated. My own words at the time: *"có thể là do câu ground claim"* ("maybe it's the grounding line") — a hypothesis, not a finding. The persona variant even drifted into a second repo's `CLAUDE.md`: the bundle had already spread into 2 divergent copies before anyone checked which part of it actually mattered.

## 3. The verification pass (Claude.AI)

A Claude.AI session checked the claims behind the restructuring against primary sources:

- **(a) affirmative > negated** rests on Jang, Ye & Seo 2022, "Can Large Language Models Truly Understand Prompts? A Case Study with Negated Prompts" (arXiv:2209.12711) — real, but tested on 2022-era models (OPT, GPT-3, InstructGPT), on **task-level negation** ("don't answer this question"), not stylistic constraints like "don't use jargon."
- **(b) persona prompting** does not reliably improve factual-task performance — Zheng et al. 2024, "When 'A Helpful Assistant' Is Not Really Helpful…", Findings of EMNLP 2024 (arXiv:2311.10054): per-persona effect on factual tasks is close to random.

It then designed an A/B kit (arms + metrics, below) and a skeleton skill, **refusing to ship rules without numbers** — the right call, since the eval later refuted my own favorite ingredient.

## 4. Independent re-verification

A Claude Code session re-verified all 4 citations against primary sources — **all confirmed** — and added 2025–26 literature the earlier handoff didn't have:

- Rana 2026, "Semantic Gravity Wells: Why Negative Constraints Backfire" (arXiv:2601.08070, Jan 2026) — 87.5% of negation violations are **priming failures**: naming the forbidden thing activates it.
- "Negation: A Pink Elephant in the LLMs' Room?" (arXiv:2503.22395).
- Elkins & Chun, "Framing Instability…" (arXiv:2601.21433) — cross-model agreement drops from 73% → 59% under negation.
- Zhou et al. 2023, "Instruction-Following Evaluation for Large Language Models" (IFEval, arXiv:2311.07911).
- Zheng et al. 2023, "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 D&B — LLM-judge biases (verbosity, self-preference), directly relevant to how this eval's own grader was set up (§6).

**Net finding:** the earlier caveat ("not yet studied on modern models") is outdated as of 2026 — the newer evidence **reinforces** preferring affirmative phrasing over negated constraints, it doesn't just leave the question open.

## 5. The eval design

Per the kit designed in §3:

- **5 arms:** A0 no rules; A1 = my grounding line verbatim; A2 = term-discipline rule (define/lead-in at first use); A3 = A1+A2; A4 = A3 + a reader-model line ("Reader: senior .NET backend developer… define only terms outside that baseline").
- **3 fixed prompts:** P1 NATS JetStream acks, P2 .NET `Channel<T>` backpressure, P3 Claude API prompt caching.
- **Isolation:** each cell = a fresh `claude -p`, scratch cwd, `--setting-sources project --strict-mcp-config` (so my own global rules can't contaminate the baseline), rule text injected via `--append-system-prompt`. Generation model: Opus 4.8. 2 reps → **30 runs**.
- **Grading:** outputs blinded to random IDs, graded by Sonnet (a different model, fresh session per file) with a count-only rubric; ~13% hand spot-checked.
- **Metrics:** M1 = undefined terms per 1k words (↓ better); M2 = grounded/total abstract claims (↑ better); M3 = over-explained baseline terms (↓ better).

## 6. Three infrastructure gotchas (why this eval almost lied)

These found during the run are worth their own section — they silently corrupt evals if you don't catch them:

- **Built-in skill contamination.** All 10 P3 runs (prompt-caching topic) triggered Claude Code's built-in `claude-api` skill → tool calls, and 2 runs returned meta-refusals instead of explanations. P3 was **excluded from clean analysis**. Lesson: an "isolated" `claude -p` session still carries built-in skills; a topic that trips one wrecks the whole cell.
- **Blind-ID seed collision.** The blinding script seeded its RNG with a constant → the second batch (the Fable transfer run, §8) drew the **same** random IDs as the first batch → the grader skipped everything (grades already existed for those IDs) and stale scores silently masqueraded as new results. Caught because the numbers looked identical per-file across supposedly independent batches. Lesson: seed by batch tag; treat "skip existing" caches as a footgun.
- **LLM grader over-counting.** The spot-check found the grader counting sentence fragments (e.g. "Your p99 is destroyed") as "undefined terms," and once listing a term the text had actually defined as undefined. The noise applies to all arms roughly equally, so **comparisons still hold**, but absolute counts are inflated. Lesson: LLM-judge numbers are **comparative, not absolute**.

## 7. Results — clean runs

P1+P2 only (P3 excluded per §6), n=4/arm, Opus 4.8, mean ±sd:

| Arm | M1 undef/1k ↓ | M2 grounding ↑ | M3 over-expl ↓ | words |
| --- | --- | --- | --- | --- |
| A0 baseline | 12.18 ±4.30 | 0.38 ±0.12 | 0.25 ±0.50 | 823 |
| A1 grounding only | 11.17 ±7.69 | 0.44 ±0.32 | 0.25 ±0.50 | 820 |
| A2 term-discipline only | 5.41 ±2.93 | 0.43 ±0.27 | 1.25 ±1.50 | 780 |
| **A3 both** | **4.06 ±3.13** | **0.47 ±0.18** | **0.75 ±0.96** | 908 |
| A4 + reader-model | 10.04 ±4.27 | 0.42 ±0.09 | 0.75 ±0.96 | 1071 |

A2 is the active ingredient for M1 (−56% alone) but doubles over-explanation when alone; A1 alone does **nothing** to M1 (my "maybe it's the grounding line" hypothesis is **refuted** as the main driver — it only mildly helps M2); A3 (the pair) dominates (−67% M1, best M2, damped M3); A4's reader-model line **regresses** M1 and inflates length +18% — refuted.

## 8. Fable 5 transfer

A0 vs A3, P1+P2, n=4: A0 M1 = 8.92 ±3.49; A3 M1 = 8.20 ±1.34. Fable's baseline is already near the rules' level; the pair mainly **narrows variance** (consistency), with no measured harm (M2 0.50→0.52; M3 0.50→0.75, within noise). Honest conclusion: **effect size is model-dependent** — biggest gains on jargon-heavy defaults (Opus), consistency gains elsewhere.

## 9. What shipped

`todd-skills` PR #43 — plugin `explaining` (a skill), shipping **only** the A3 pair + self-check + an evidence note with the numbers and their bounds. Excluded: the reader-model rule (refuted by A4), persona framing (refuted by arXiv:2311.10054), and an untested stopping-condition rule (the residual M3 = 0.75 is documented as a known limitation instead of being "fixed" with an unverified rule). Regression fixtures live in `plugins/explaining/evals/evals.json` (the repo's eval-harness shape). Full evidence artifact: `docs/superpowers/evidence/2026-07-18-explaining-skill-ab-eval.json` (30 per-run rows, generation/grading method, and the decision log).

The PR went through two independent review passes before merge: a **rules reviewer** caught a wrong component id in the ADR (`c3-218` → `c3-201`), missing C3 architecture-doc wiring/codemap coverage for `plugins/explaining/**`, and a category mismatch; an **adversarial auditor** independently confirmed the same class of gaps. All were fixed and re-verified before the merge — a small demonstration, inside the project's own tooling, of the same "verify before shipping" principle the eval itself is about. PR #43 merged as a regular 2-parent merge commit `98b35db`; the skill is now live on this machine via `~/.claude/skills/explaining` → the plugin's skill directory, so it applies automatically to sessions going forward.

---

## Key takeaways

1. A bundle that "works" tells you nothing about **which part** works; my own favorite ingredient turned out inert for the headline metric.
2. Verification ≠ vibes: 2 of 4 candidate rules died on contact with data; the survivors carry their numbers in the shipped skill so future edits stay evidence-gated.
3. Eval infrastructure fails silently (builtin-skill contamination, ID collision, judge over-counting) — the eval **of** the eval matters as much as the eval.
4. Literature check: prefer affirmative operational directives over negative constraints and personas — now backed by 2025-26 mechanistic work, not just 2022 inverse-scaling.

## Sources

- Jang, Ye & Seo 2022, "Can Large Language Models Truly Understand Prompts? A Case Study with Negated Prompts", arXiv:2209.12711 — <https://arxiv.org/abs/2209.12711>
- Zheng et al. 2024, "When 'A Helpful Assistant' Is Not Really Helpful…", Findings of EMNLP 2024, arXiv:2311.10054 — <https://arxiv.org/abs/2311.10054>
- Zhou et al. 2023, "Instruction-Following Evaluation for Large Language Models" (IFEval), arXiv:2311.07911 — <https://arxiv.org/abs/2311.07911>
- Rana 2026, "Semantic Gravity Wells: Why Negative Constraints Backfire", arXiv:2601.08070
- Elkins & Chun 2026, "Framing Instability in LLM Ethical Stance…", arXiv:2601.21433
- "Negation: A Pink Elephant in the Large Language Models' Room?", arXiv:2503.22395
- Zheng et al. 2023, "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 D&B
- Full run-level evidence and shipped skill: `todd-skills` repo, PR #43 (merged, commit `98b35db`), `docs/superpowers/evidence/2026-07-18-explaining-skill-ab-eval.json`
