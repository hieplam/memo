---
title: "Inside the Brainstorming Skill, Part 1: Dialogue, Not Interrogation"
description: "The six principles that shape every question the brainstorming skill asks — one at a time, multiple-choice preferred, YAGNI-ruthless — and the three targets each question is secretly aiming at: purpose, constraints, success criteria."
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

> **"Inside the Brainstorming Skill" — Part 1 of 7.** The six principles behind every question the
> skill asks — one at a time, multiple-choice preferred, YAGNI-ruthless — and the three targets each
> question secretly aims at: purpose, constraints, success criteria. Source-grounded in the
> Superpowers `brainstorming` skill's own files; every claim is cited `file:line`.

---

The previous post mapped the whole skill from above. Now we descend into the part that makes
it _Socratic_: the rules that govern how it asks. Before we trace the question loop itself
(that is Part 2), we need to understand the philosophy underneath it — because the loop is just
these principles in motion.

## "Natural collaborative dialogue"

The skill frames its method in its second sentence:

> "Help turn ideas into fully formed designs and specs through natural collaborative dialogue.
> Start by understanding the current project context, then ask questions one at a time to
> refine the idea."
> — `SKILL.md:8,10`

That word **"dialogue"** is doing real work. A non-Socratic agent treats requirements as a
form to be filled: it dumps ten questions, collects ten answers, and proceeds. The
brainstorming skill refuses that. It insists on a back-and-forth where each answer informs the
next question. The repo summarizes this posture as _"Socratic design refinement"_
(`README.md:232`) — drawing the design out of the human, one exchange at a time.

## The six principles

At the bottom of the skill is a section called **Key Principles** (`SKILL.md:133–140`). These
six rules are the constitution of the dialogue.

![The six principles behind the Socratic dialogue](/memo/diagrams/brainstorming-skill/01-principles.svg)

### 1. One question at a time

> "Don't overwhelm with multiple questions." — `SKILL.md:135`

Reinforced in the process notes:

> "Only one question per message — if a topic needs more exploration, break it into multiple
> questions." — `SKILL.md:72`

This is the single most characteristic behavior of the skill, and Part 2 is devoted to it.
The constraint is absolute: _exactly one question per message._ If a topic is rich, it becomes
several turns, not one crowded turn.

### 2. Multiple-choice preferred

> "Easier to answer than open-ended when possible." — `SKILL.md:136`
>
> "Prefer multiple choice questions when possible, but open-ended is fine too." — `SKILL.md:71`

A subtle but important bias. Open-ended questions ("What do you want?") put the cognitive load
on the human. Multiple-choice questions ("A, B, or C?") put it on the agent, which has to do
the work of enumerating real options first. The skill prefers the latter — it is a more
considerate, and more decisive, way to interview.

### 3. YAGNI ruthlessly

> "Remove unnecessary features from all designs." — `SKILL.md:137`

"YAGNI" — _You Aren't Gonna Need It._ This is the only principle that _removes_ rather than
_gathers._ The dialogue is not just additive; part of its job is to talk scope **down**, not
just up. A good brainstorming session ends with a smaller, sharper idea than it started with.

### 4. Explore alternatives

> "Always propose 2–3 approaches before settling." — `SKILL.md:138`

The skill never lets the first idea win by default. Even when the agent has a clear preference,
it must surface alternatives so the choice is made consciously. (Part 3 covers how these
approaches are presented — recommendation first.)

### 5. Incremental validation

> "Present design, get approval before moving on." — `SKILL.md:139`

Approval is not a single event at the end. It is granted piece by piece. This is what keeps a
long design conversation from collapsing at the finish line — each section is ratified before
the next is built on top of it.

### 6. Be flexible

> "Go back and clarify when something doesn't make sense." — `SKILL.md:140`

The flow is a loop, not a line. If an answer contradicts an earlier assumption, the agent is
expected to circle back and re-clarify rather than barrel forward. The diagrams in this series
show that as dashed back-edges, and they are not decoration — they are the mechanism.

## What every question is secretly aiming at

The principles tell the agent _how_ to ask. One more line tells it _what to ask about_:

> "Focus on understanding: purpose, constraints, success criteria." — `SKILL.md:73`

Every well-formed brainstorming question is a probe toward one of three targets:

- **Purpose** — _why_ are we building this? What problem does it solve?
- **Constraints** — what limits the solution? Existing patterns, tech, time.
- **Success criteria** — how will we know it worked? What does "done" look like?

This is the quiet engine of the Socratic method here. The agent is not collecting trivia; it
is filling in three specific buckets. When all three are full enough to design against, the
interview is over — which is exactly the convergence test we will see in Part 2.

## Why this is "Socratic" and not just "asking questions"

Socratic questioning, classically, is the practice of drawing knowledge and clarity out of
someone through structured questions rather than lecturing them. Map that onto these six
principles and the fit is exact:

- one question at a time → the patient, turn-by-turn cadence of a dialogue;
- multiple-choice and "purpose/constraints/success" → questions aimed at eliciting the
  human's own latent requirements;
- be flexible / go back → following the answer where it leads, not a fixed script;
- YAGNI → using questions to _strip away_ the unexamined, not just accumulate.

The skill never claims the Socratic mantle in its body. It simply behaves that way, by rule.
In the next post we watch those rules run as a single tight loop.

---

### Sources

- `skills/brainstorming/SKILL.md` — lines 8–10 (dialogue), 70–73 (one-at-a-time, MCQ,
  purpose/constraints/success), 133–140 (the six Key Principles)
- `README.md:232` — "Socratic design refinement"

---

← **Previous:** [Part 0 — The Map](/memo/posts/brainstorming-skill-part-0-the-map/) · **Next:** [Part 2 — The Interview Engine](/memo/posts/brainstorming-skill-part-2-the-interview-engine/) →

**The series — Inside the Brainstorming Skill:** [0 · The Map](/memo/posts/brainstorming-skill-part-0-the-map/) · **1 · Dialogue, Not Interrogation (you are here)** · [2 · The Interview Engine](/memo/posts/brainstorming-skill-part-2-the-interview-engine/) · [3 · From Answers to Design](/memo/posts/brainstorming-skill-part-3-from-answers-to-design/) · [4 · The Spec Pipeline](/memo/posts/brainstorming-skill-part-4-the-spec-pipeline/) · [5 · The Visual Companion](/memo/posts/brainstorming-skill-part-5-the-visual-companion/) · [6 · Under the Hood](/memo/posts/brainstorming-skill-part-6-under-the-hood/)
