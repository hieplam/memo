---
title: "Inside the Brainstorming Skill, Part 0: The Map"
description: "A top-down tour of the Superpowers brainstorming skill — the hard gate that stops premature code, the nine-step checklist, and the single legal exit. The whole machine on one page before we drill into the Socratic core."
pubDatetime: 2026-06-18T00:00:00Z
lang: en
tags:
  - claude-code
  - superpowers
  - skills
  - brainstorming
  - socratic-method
  - agent-design
---

> **"Inside the Brainstorming Skill" — Part 0 of 7.** A top-down tour of the whole skill: the
> hard gate that blocks premature code, the nine-step checklist, and the single legal exit — the
> entire machine on one page before we drill into the Socratic core. This series reverse-documents
> the Superpowers `brainstorming` skill from its own source files; every claim is cited `file:line`.

---

There is a small file in the [Superpowers](https://github.com/obra/superpowers) plugin that
changes how an AI agent starts working. Before it writes a line of code, before it scaffolds
a project, before it reaches for any other skill, it stops and asks you questions. The file
is `skills/brainstorming/SKILL.md`, and this series is a careful, source-grounded tour of how
it works — with its **Socratic interview method** as the main attraction.

This first post is the map. We will look at the whole machine from above before we drill into
any single gear.

## What the skill is for

The skill's own one-line job description is blunt about _when_ it fires:

> "You MUST use this before any creative work — creating features, building components, adding
> functionality, or modifying behavior. Explores user intent, requirements and design before
> implementation."
> — `SKILL.md:3`

And its purpose statement:

> "Help turn ideas into fully formed designs and specs through natural collaborative dialogue."
> — `SKILL.md:8`

Note the phrase **"natural collaborative dialogue."** The repo's own `README.md:232` gives
that dialogue a name — _"Socratic design refinement"_ — but the skill body never says
"Socratic." The method is not a label it wears; it is the _shape_ of how it behaves: it
draws a design **out of you** through questions instead of presenting one **to you**. Holding
that distinction is the point of the whole series.

## The whole lifecycle, top-down

![End-to-end lifecycle of the brainstorming skill](/memo/diagrams/brainstorming-skill/00-lifecycle.svg)

Read the diagram top to bottom and you have the entire skill. A creative request trips the
skill; a hard gate slams down; the agent works through a nine-step checklist; and the only
way out the bottom is to hand off to a different skill called `writing-plans`. Everything in
this series is a zoom-in on one band of that picture.

## The hard gate: no code before a design

The first thing the skill establishes is a prohibition, set off in its own tagged block:

> "Do NOT invoke any implementation skill, write any code, scaffold any project, or take any
> implementation action until you have presented a design and the user has approved it. This
> applies to EVERY project regardless of perceived simplicity."
> — `SKILL.md:12–14`

This is the load-bearing rule. Without it, an eager agent reads "make a react todo list" and
starts typing. With it, the agent is forced into dialogue first. The skill even pre-empts the
obvious objection with a section literally titled _"This Is Too Simple To Need A Design"_:

> "Every project goes through this process. A todo list, a single-function utility, a config
> change — all of them. 'Simple' projects are where unexamined assumptions cause the most
> wasted work."
> — `SKILL.md:16–18`

The design can be a few sentences for a genuinely simple project — but it **must** be
presented and approved. The gate has no size exemption.

## The nine-step checklist

The skill instructs the agent to create a task for each of nine items and complete them in
order (`SKILL.md:20–32`):

1. **Explore project context** — files, docs, recent commits
2. **Offer the visual companion just-in-time** — not upfront (see Part 5)
3. **Ask clarifying questions** — one at a time; purpose, constraints, success criteria
4. **Propose 2–3 approaches** — with trade-offs and a recommendation
5. **Present design** — in sections scaled to complexity, approval after each
6. **Write design doc** — to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, and commit
7. **Spec self-review** — scan for placeholders, contradictions, ambiguity, scope
8. **User reviews written spec** — a human gate before proceeding
9. **Transition to implementation** — invoke the `writing-plans` skill

Steps 3 is the Socratic heart of the skill, and it gets two full posts (Parts 1 and 2). Steps
4–5 are the design conversation (Part 3). Steps 6–8 are the spec pipeline (Part 4). Step 2 —
the visual companion — is woven through all of it (Part 5).

## The single legal exit

The checklist ends at one specific place, and the skill is emphatic that there is only one:

> "The terminal state is invoking writing-plans. Do NOT invoke frontend-design, mcp-builder,
> or any other implementation skill. The ONLY skill you invoke after brainstorming is
> writing-plans."
> — `SKILL.md:61`

This is what the double-circle node at the bottom of the diagram means. Brainstorming does not
build anything. Its entire job is to converge on an approved, written design and then hand the
baton to the planning skill. Everything between the gate and that handoff is structured
conversation.

## What the flow actually guarantees

Strip the skill to its essence and it enforces three things, in order:

- **No building before understanding** — the hard gate (`SKILL.md:12–14`).
- **Understanding is built by dialogue, not assumption** — the one-question-at-a-time loop
  (`SKILL.md:70–73`).
- **Nothing proceeds without two explicit human approvals** — once on the design
  (`SKILL.md:51–53` in the process-flow graph), once on the written spec (`SKILL.md:121–126`).

Those are the load-bearing beams. The next post zooms into the first gear of the dialogue
itself: the six principles that shape every question the skill asks.

---

### Sources

- `skills/brainstorming/SKILL.md` — lines 2–3 (trigger), 8–10 (purpose), 12–18 (hard gate &
  "too simple"), 20–32 (checklist), 36–61 (process flow & terminal state)
- `README.md:232` — "Socratic design refinement"

---

**Next:** [Part 1 — Dialogue, Not Interrogation](/memo/posts/brainstorming-skill-part-1-dialogue-not-interrogation/) →

**The series — Inside the Brainstorming Skill:** **0 · The Map (you are here)** · [1 · Dialogue, Not Interrogation](/memo/posts/brainstorming-skill-part-1-dialogue-not-interrogation/) · [2 · The Interview Engine](/memo/posts/brainstorming-skill-part-2-the-interview-engine/) · [3 · From Answers to Design](/memo/posts/brainstorming-skill-part-3-from-answers-to-design/) · [4 · The Spec Pipeline](/memo/posts/brainstorming-skill-part-4-the-spec-pipeline/) · [5 · The Visual Companion](/memo/posts/brainstorming-skill-part-5-the-visual-companion/) · [6 · Under the Hood](/memo/posts/brainstorming-skill-part-6-under-the-hood/)
