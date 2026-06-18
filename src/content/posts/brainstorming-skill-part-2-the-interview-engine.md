---
title: "Inside the Brainstorming Skill, Part 2: The Interview Engine"
description: "The Socratic drill-down. How the brainstorming skill converts a vague idea into a buildable design through a single tight loop — scope triage, pick the next unknown, ask exactly one question, end the turn, integrate, and test for convergence. The mechanism, step by step."
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

> **"Inside the Brainstorming Skill" — Part 2 of 7.** The post the series exists for: how the skill
> converts a vague idea into a buildable design through a single tight loop — scope triage, pick the
> next unknown, ask exactly one question, end the turn, integrate, test for convergence. Source-grounded
> in the Superpowers `brainstorming` skill's own files; every claim is cited `file:line`.

---

This is the post the series exists for. Parts 0 and 1 set up the machine and its principles;
here we watch the Socratic method actually run. The "interview engine" is not a component you
will find named in the source — it is the loop that _emerges_ when the principles from Part 1
are applied turn after turn. This post reconstructs that loop from the skill's own
instructions and traces it gear by gear.

![The Socratic interview engine](/memo/diagrams/brainstorming-skill/02-interview-engine.svg)

Follow the diagram alongside the walkthrough. The amber dashed line is the loop — and the loop
is the whole story.

## Before the first question: scope triage

The interview does not begin by asking about details. It begins by checking whether details
are even the right thing to ask about yet. The skill calls this out explicitly:

> "Before asking detailed questions, assess scope: if the request describes multiple
> independent subsystems (e.g., 'build a platform with chat, file storage, billing, and
> analytics'), flag this immediately. Don't spend questions refining details of a project that
> needs to be decomposed first."
> — `SKILL.md:68`

If the request is too big for one design, the skill's job changes from _interview_ to
_decompose_:

> "If the project is too large for a single spec, help the user decompose into sub-projects:
> what are the independent pieces, how do they relate, what order should they be built? Then
> brainstorm the first sub-project through the normal design flow. Each sub-project gets its
> own spec → plan → implementation cycle."
> — `SKILL.md:69`

This is the top diamond in the diagram. A "yes" routes out to decomposition and then _re-enters
the same loop_ for the first sub-project. A "no" drops straight into questioning. It is a
guard clause: don't run the interview on a question that is secretly four questions.

## The loop, one turn at a time

Once scope is settled, the engine runs. Each pass through it is **one conversational turn** —
and that constraint is what makes it Socratic rather than a questionnaire.

### Step 1 — Pick the next most valuable unknown

The agent looks at what it still doesn't know and selects the single most useful gap to close.
The selection isn't arbitrary; from Part 1 we know the target space is fixed:

> "Focus on understanding: purpose, constraints, success criteria." — `SKILL.md:73`

So "the next unknown" is always a hole in one of those three buckets — _why_, _what limits it_,
or _what done looks like_. The agent is, in effect, doing triage on its own ignorance.

### Step 2 — Frame it as exactly one question

This is the hard constraint, stated twice in the source for emphasis:

> "Only one question per message — if a topic needs more exploration, break it into multiple
> questions." — `SKILL.md:72`
>
> "One question at a time — Don't overwhelm with multiple questions." — `SKILL.md:135`

And the framing bias:

> "Prefer multiple choice questions when possible, but open-ended is fine too." — `SKILL.md:71`

A rich topic is not compressed into a dense multi-part question. It is _split across multiple
turns._ This is the single rule that most distinguishes the skill's behavior from an ordinary
agent's. An ordinary agent, asked to build something, fires a paragraph of questions to "be
efficient." This skill refuses — because a wall of questions forces the human to context-switch
six times and answer shallowly. One question gets one considered answer.

### Step 3 — Choose the channel (and maybe show instead of tell)

Before asking, the agent makes a per-question judgment: is this question _clearer shown than
told?_ Most questions are textual and stay in the terminal. But a question about layout, visual
hierarchy, or a side-by-side comparison may be better as a rendered mockup in the **visual
companion** (Part 5):

> "Even after the user accepts, decide FOR EACH QUESTION whether to use the browser or the
> terminal. The test: would the user understand this better by seeing it than reading it?"
> — `SKILL.md:151`

In the diagram this is the second diamond. It does not change the loop's logic — it only
changes the _medium_ of the question. The Socratic cadence is identical whether the question is
a line of text or a clickable mockup.

### Step 4 — Ask, then end the turn and wait

The agent asks its one question and **stops.** This is implicit but essential: a single
question per message only means anything if the agent then yields the floor. The turn ends; the
human answers. There is no batching, no "and while you're at it." The discipline of ending the
turn is what makes the dialogue a dialogue.

### Step 5 — Integrate the answer (and prune)

When the human replies, the agent folds the answer into its growing understanding — and,
critically, _prunes_:

> "YAGNI ruthlessly — Remove unnecessary features from all designs." — `SKILL.md:137`

Each answer can add scope, but it can also _reveal_ scope that should be cut. Integration is
not just accumulation; it is editing. The mental model of the design after turn N is sharper —
sometimes smaller — than after turn N−1.

### Step 6 — Test for convergence

Now the decisive question, which the agent asks _itself_, not the human: **do I understand
purpose, constraints, and success criteria well enough to design?** This is the convergence
test (`SKILL.md:73` defines the three buckets; the surrounding flow defines the exit). Two
outcomes:

- **Not yet** — a bucket still has a gap → loop back to Step 1 and pick the next unknown.
- **Yes** — all three buckets are full enough → exit the interview and move to proposing
  approaches (Part 3).

## The two reasons the loop runs again

The back-edge in the diagram carries two distinct meanings, and both come straight from the
principles:

1. **A gap remains.** The ordinary case — the agent simply doesn't know enough yet, so it asks
   the next question.
2. **An answer contradicted an earlier assumption.** Here the loop is corrective, not just
   additive. Principle six demands it:

   > "Be flexible — Go back and clarify when something doesn't make sense." — `SKILL.md:140`

   This is what keeps the interview honest. When turn 5's answer breaks an assumption made on
   turn 2, the agent does not paper over it — it loops back and re-clarifies. The flow _bends_.

## Why "one question at a time" is the linchpin

It is tempting to read "one question per message" as a stylistic nicety. It is not. It is the
mechanism that makes every other principle possible:

- **It enables integration.** You can only let answer N shape question N+1 if you ask them one
  at a time. Batched questions are frozen the moment they're sent.
- **It enables flexibility.** Going back to re-clarify only makes sense in a turn-by-turn
  dialogue; you can't "go back" inside a single mega-question.
- **It enables convergence.** The loop has a natural stopping point — _all three buckets full_ —
  only because each turn closes one gap. A questionnaire has no convergence test; it just ends
  when the form runs out.

Take away one-at-a-time and the Socratic method collapses into a form. Keep it, and a vague
sentence like "let's make a react todo list" becomes, over a handful of patient turns, a
design precise enough to build. That is the engine.

## The output of the engine

When the loop exits, the agent is holding three full buckets — a clear sense of purpose,
constraints, and success criteria. That shared understanding is the raw material for the next
phase: turning it into a concrete design through _approaches_ and _incremental validation_.
That is Part 3.

---

### Sources

- `skills/brainstorming/SKILL.md` — lines 65–73 (understanding the idea; scope triage;
  one-at-a-time; MCQ; purpose/constraints/success), 68–69 (decomposition), 135–140 (Key
  Principles), 151 (per-question channel choice)

---

← **Previous:** [Part 1 — Dialogue, Not Interrogation](/memo/posts/brainstorming-skill-part-1-dialogue-not-interrogation/) · **Next:** [Part 3 — From Answers to Design](/memo/posts/brainstorming-skill-part-3-from-answers-to-design/) →

**The series — Inside the Brainstorming Skill:** [0 · The Map](/memo/posts/brainstorming-skill-part-0-the-map/) · [1 · Dialogue, Not Interrogation](/memo/posts/brainstorming-skill-part-1-dialogue-not-interrogation/) · **2 · The Interview Engine (you are here)** · [3 · From Answers to Design](/memo/posts/brainstorming-skill-part-3-from-answers-to-design/) · [4 · The Spec Pipeline](/memo/posts/brainstorming-skill-part-4-the-spec-pipeline/) · [5 · The Visual Companion](/memo/posts/brainstorming-skill-part-5-the-visual-companion/) · [6 · Under the Hood](/memo/posts/brainstorming-skill-part-6-under-the-hood/)
