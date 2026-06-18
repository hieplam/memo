---
title: "Inside the Brainstorming Skill, Part 4: The Spec Pipeline"
description: "A validated design isn't the finish line. The skill writes it to a dated, committed spec, reviews it with fresh eyes, optionally dispatches a reviewer subagent, and then stops at a hard human gate before handing off to writing-plans."
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

> **"Inside the Brainstorming Skill" — Part 4 of 7.** A validated design isn't the finish line: the
> skill writes it to a dated, committed spec, reviews it with fresh eyes, optionally dispatches a
> reviewer subagent, then stops at a hard human gate before handing off to `writing-plans`.
> Source-grounded in the skill's own files; every claim is cited `file:line`.

---

By the end of Part 3, the design is agreed — section by section, out loud, in conversation. A
lesser skill would start building now. The brainstorming skill instead does something
deliberately slow: it turns the _conversation_ into a _document_, scrutinizes that document,
and then refuses to proceed until a human signs off on it. This is the spec pipeline.

![Locking it down — the spec pipeline](/memo/diagrams/brainstorming-skill/04-spec-pipeline.svg)

## Why write it down at all

The conversation that produced the design is ephemeral and scattered across many turns. The
spec collapses it into one durable, reviewable artifact. The skill is specific about where it
goes and that it gets committed:

> "Write the validated design (spec) to
> `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. (User preferences for spec location
> override this default.) Use elements-of-style:writing-clearly-and-concisely skill if
> available. Commit the design document to git."
> — `SKILL.md:106–109`

Three details matter here. The path is **dated and topic-named**, so specs accumulate as a
legible history. The location is a **default, not a mandate** — the user can override it. And
the spec is **committed to git**, which makes it a real checkpoint in the project's history,
not a scratch note.

## Self-review with fresh eyes

Immediately after writing the spec, the agent reviews its own work. The instruction is to look
at it as if someone else wrote it:

> "After writing the spec document, look at it with fresh eyes." — `SKILL.md:111–112`

The review is a fixed four-point checklist (`SKILL.md:114–117`):

1. **Placeholder scan** — any "TBD", "TODO", incomplete sections, or vague requirements? Fix
   them.
2. **Internal consistency** — do any sections contradict each other? Does the architecture
   match the feature descriptions?
3. **Scope check** — is this focused enough for a single implementation plan, or does it need
   decomposition?
4. **Ambiguity check** — could any requirement be read two different ways? If so, pick one and
   make it explicit.

And the disposition is pragmatic — _fix and move on_:

> "Fix any issues inline. No need to re-review — just fix and move on." — `SKILL.md:119`

Note what each check is really guarding against. Placeholders are unfinished thinking.
Contradictions are two unreconciled decisions. Scope creep is a plan that will sprawl. Ambiguity
is the seed of building the wrong thing. The checklist is a filter for the four ways a spec
quietly fails.

## The optional reviewer subagent

Alongside the skill body there is a separate template,
`spec-document-reviewer-prompt.md`, for dispatching a _second pair of eyes_ — a reviewer
subagent — after the spec is written. Its purpose:

> "Verify the spec is complete, consistent, and ready for implementation planning."
> — `spec-document-reviewer-prompt.md:5`

It checks the same families of issue as the self-review — completeness, consistency, clarity,
scope, YAGNI — but with an explicit calibration toward _only flagging real problems_:

> "Only flag issues that would cause real problems during implementation planning… Approve
> unless there are serious gaps that would lead to a flawed plan."
> — `spec-document-reviewer-prompt.md:29–34`

It returns a structured verdict — **Status**, **Issues**, **Recommendations**
(`spec-document-reviewer-prompt.md:38–49`). In the diagram this node is drawn dashed and labeled
_optional_, because it is exactly that: the skill's own process-flow graph (`SKILL.md:36–59`)
shows only the self-review on the critical path. The reviewer subagent is an available tool, not
a mandatory step.

## The human gate

This is the second of the skill's two hard human approvals (the first was approving the design,
in Part 3). After the spec is written and reviewed, the agent stops and asks the human to read
it — with an almost scripted message:

> "Spec written and committed to `<path>`. Please review it and let me know if you want to make
> any changes before we start writing out the implementation plan."
> — `SKILL.md:124`

And then it waits:

> "Wait for the user's response. If they request changes, make them and re-run the spec review
> loop. Only proceed once the user approves."
> — `SKILL.md:126`

The diagram shows this as the decision diamond with its dashed back-edge: _changes requested_
loops back to rewriting the spec (and re-running the review); _approved_ is the only path
forward. This gate exists because the spec is the contract the next skill will build a plan
against. A wrong spec produces a confidently-wrong plan. The human sign-off is the last cheap
moment to catch that.

## The handoff

Past the gate, the pipeline terminates exactly where Part 0 said it would — at `writing-plans`,
and nowhere else:

> "Invoke the writing-plans skill to create a detailed implementation plan. Do NOT invoke any
> other skill. writing-plans is the next step."
> — `SKILL.md:130–131`

That is the whole arc of the brainstorming skill: a vague idea enters at the hard gate, a
Socratic interview converts it into shared understanding, the understanding becomes a
section-approved design, the design becomes a committed-and-reviewed spec, and a human approves
that spec — at which point, and only then, the baton passes to planning.

There is one thread we have deferred the whole way through: the **visual companion**, the skill's
ability to ask its questions by _showing_ instead of _telling_. That is the final post.

---

### Sources

- `skills/brainstorming/SKILL.md` — lines 104–109 (write & commit the spec), 111–119
  (self-review checklist), 121–126 (user review gate, exact message), 128–131 (handoff to
  writing-plans), 36–59 (process-flow graph)
- `skills/brainstorming/spec-document-reviewer-prompt.md` — lines 5 (purpose), 18–34 (checks &
  calibration), 36–49 (output format)

---

← **Previous:** [Part 3 — From Answers to Design](/memo/posts/brainstorming-skill-part-3-from-answers-to-design/) · **Next:** [Part 5 — The Visual Companion](/memo/posts/brainstorming-skill-part-5-the-visual-companion/) →

**The series — Inside the Brainstorming Skill:** [0 · The Map](/memo/posts/brainstorming-skill-part-0-the-map/) · [1 · Dialogue, Not Interrogation](/memo/posts/brainstorming-skill-part-1-dialogue-not-interrogation/) · [2 · The Interview Engine](/memo/posts/brainstorming-skill-part-2-the-interview-engine/) · [3 · From Answers to Design](/memo/posts/brainstorming-skill-part-3-from-answers-to-design/) · **4 · The Spec Pipeline (you are here)** · [5 · The Visual Companion](/memo/posts/brainstorming-skill-part-5-the-visual-companion/) · [6 · Under the Hood](/memo/posts/brainstorming-skill-part-6-under-the-hood/)
