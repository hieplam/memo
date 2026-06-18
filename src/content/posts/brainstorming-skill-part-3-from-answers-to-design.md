---
title: "Inside the Brainstorming Skill, Part 3: From Answers to Design"
description: "Once the Socratic interview converges, the skill stops asking and starts proposing — but never all at once. How it floats 2–3 approaches recommendation-first, then ratifies the design one section at a time."
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

> **"Inside the Brainstorming Skill" — Part 3 of 7.** Once the interview converges, the skill stops
> asking and starts proposing — but never all at once: 2–3 approaches recommendation-first, then a
> design ratified one section at a time. Source-grounded in the Superpowers `brainstorming` skill's
> own files; every claim is cited `file:line`.

---

The interview engine from Part 2 exits with three full buckets — purpose, constraints, success
criteria. Now the skill changes mode. It stops drawing things _out_ of you and starts putting a
concrete design _in front of_ you. But the Socratic discipline doesn't switch off; it just
changes shape. The design is still validated incrementally, still one piece at a time.

![From answers to design — incremental validation](/memo/diagrams/brainstorming-skill/03-design-validation.svg)

## First: never let the first idea win by default

Before presenting a design, the skill forces a fork in the road:

> "Propose 2–3 different approaches with trade-offs. Present options conversationally with your
> recommendation and reasoning. Lead with your recommended option and explain why."
> — `SKILL.md:77–79`

Three things are happening in that instruction:

- **Plurality is mandatory.** Even when the agent is confident, it must surface 2–3 real
  approaches. This is principle four from Part 1 — _explore alternatives_ (`SKILL.md:138`) — in
  practice. It prevents the very common failure where the first idea the agent thinks of
  silently becomes the only idea considered.
- **The recommendation leads.** The agent does not present a neutral menu and shrug. It leads
  with its pick and the reasoning, so the human is reacting to a considered position, not doing
  the agent's deciding for it.
- **It stays conversational.** This is a discussion, not a spec dump. The human can push back on
  the recommendation, and often that pushback is itself a requirement surfacing late.

In the diagram, this is the "A ★ recommended / B / C" cluster. The recommendation is
highlighted because that is how the skill presents it — opinion first, alternatives in support.

## Then: present the design in sections, scaled to complexity

With an approach chosen, the agent presents the actual design. The rule that governs _how_ is
about proportion:

> "Once you believe you understand what you're building, present the design. Scale each section
> to its complexity: a few sentences if straightforward, up to 200–300 words if nuanced. Ask
> after each section whether it looks right so far."
> — `SKILL.md:83–85`

Two ideas worth separating:

**Sections scaled to complexity.** A trivial part of the design gets a sentence. A subtle part
gets up to a few hundred words. The agent is not padding every section to the same length; it
spends words where the risk is. This is the same instinct as YAGNI, applied to _explanation_
rather than _features_ — don't over-produce where it isn't earned.

**Approval after each section.** This is principle five — _incremental validation_
(`SKILL.md:139`) — and it is the Socratic method surviving into the design phase. The agent
does not present a finished 2,000-word design and ask "good?" at the end. It presents a piece,
asks "does this look right so far?", and only then builds the next piece on top. The diagram
shows this as the "Section looks right?" loop: a _no_ sends the agent back to revise and
re-present that same section; a _yes_ advances to the next one.

## What the sections must cover

The skill names the surface area a design is expected to span:

> "Cover: architecture, components, data flow, error handling, testing." — `SKILL.md:86`

That checklist appears in the diagram as the coverage panel. It is not a rigid template — a
simple project may touch some of these in a sentence each — but it is the agent's reminder that
a design is not just "what it does." It is also _how it's structured, how data moves through it,
how it fails, and how it's proven._ The inclusion of **testing** as a first-class design concern
is notable: the skill treats "how will we know this works?" as part of the design, not an
afterthought.

## Designing for isolation

One more instruction shapes _what kind_ of design the skill steers toward. It asks the agent to
decompose the system into well-bounded units:

> "Break the system into smaller units that each have one clear purpose, communicate through
> well-defined interfaces, and can be understood and tested independently. For each unit, you
> should be able to answer: what does it do, how do you use it, and what does it depend on?"
> — `SKILL.md:91–92`

And it gives a crisp test for whether the boundaries are good:

> "Can someone understand what a unit does without reading its internals? Can you change the
> internals without breaking consumers? If not, the boundaries need work."
> — `SKILL.md:93`

This is the skill encoding a design value, not just a process. A "good" brainstorming output
isn't merely approved — it is _modular_, testable, and comprehensible in pieces. The same
section even notes the pragmatic reason: smaller, well-bounded units are easier for the agent
itself to reason about and edit reliably (`SKILL.md:94`).

## Working inside an existing codebase

When there is already code, the skill adds a constraint and a permission:

- **Constraint:** "Explore the current structure before proposing changes. Follow existing
  patterns." (`SKILL.md:98`)
- **Permission:** where existing code has problems that affect the work, "include targeted
  improvements as part of the design — the way a good developer improves code they're working
  in." (`SKILL.md:99`)
- **Limit:** "Don't propose unrelated refactoring. Stay focused on what serves the current
  goal." (`SKILL.md:100`)

So the design phase is context-aware: it fits the new work into the grain of what exists,
improves what it must touch, and resists the temptation to refactor the world.

## The exit

When every section has been presented and approved, the design conversation is over. The
output is a validated design — agreed section by section, scaled to complexity, modular by
construction. The next step is to make it durable: write it down, review it, and get a final
human sign-off before any planning begins. That is the spec pipeline, and it is Part 4.

---

### Sources

- `skills/brainstorming/SKILL.md` — lines 75–79 (approaches, recommendation-first), 82–87
  (sections scaled to complexity, approval after each, coverage list), 89–94 (design for
  isolation), 96–100 (existing codebases), 137–139 (Key Principles: YAGNI, alternatives,
  incremental validation)

---

← **Previous:** [Part 2 — The Interview Engine](/memo/posts/brainstorming-skill-part-2-the-interview-engine/) · **Next:** [Part 4 — The Spec Pipeline](/memo/posts/brainstorming-skill-part-4-the-spec-pipeline/) →

**The series — Inside the Brainstorming Skill:** [0 · The Map](/memo/posts/brainstorming-skill-part-0-the-map/) · [1 · Dialogue, Not Interrogation](/memo/posts/brainstorming-skill-part-1-dialogue-not-interrogation/) · [2 · The Interview Engine](/memo/posts/brainstorming-skill-part-2-the-interview-engine/) · **3 · From Answers to Design (you are here)** · [4 · The Spec Pipeline](/memo/posts/brainstorming-skill-part-4-the-spec-pipeline/) · [5 · The Visual Companion](/memo/posts/brainstorming-skill-part-5-the-visual-companion/) · [6 · Under the Hood](/memo/posts/brainstorming-skill-part-6-under-the-hood/)
