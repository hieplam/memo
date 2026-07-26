---
title: "The Self-Improvement Loop I Kept Looking For, and Finally Stumbled Into"
description: "I picked up the idea of a self-improvement loop from a post by Boris, but that post only named the idea — it never showed the mechanics. Then, working on a pet project, Claude Code asked me one question about an unwritten convention, and I realized I had just built the loop by accident."
pubDatetime: 2026-07-26T02:00:00Z
featured: true
lang: "en"
tags:
  - ai-agents
  - claude-code
  - workflow
  - tech-debt
multiLangKey: "self-improvement-loop"
---

> Written by me, with AI used only to tidy up the wording. This is a personal, reflective piece.
>
> Date: 2026-07-26

---

## 1. Any level is fine, as long as it isn't Level 0

I remember reading a post by Boris — I think it was the one about the **4 levels of adaptation**, the four stages people go through as they learn to work alongside AI. I'm not sure which level I'm at, but I was at least relieved I wasn't sitting at Level 0 😅

Back to the point. There was an idea somewhere around level 3 or 4: the more you want to break out of the AI's loop inside your workflow, the more you need to build a **self-improvement loop**.

The way I understood it, you have to set up a workflow where the AI can correct its own mistakes, or get better on its own over time. The post only stated the idea. It never said how. So I kept turning it over: how do you actually do that?

And I noticed something else. Since I started using Claude Code, I've barely written code at all — not at work, not on personal projects. And yet I still hadn't built a single self-improvement loop like that.

## 2. A hunch: 1% at a time, as long as you keep showing up

From my own experience, I had a vague sense that it had to involve **incremental improvement**.

Meaning it doesn't have to get better right away. 1% each time is enough. The core of it is **resilience** — you have to be able to keep doing it. Not necessarily every single day, as long as you stay with it.

**Just keep grinding away at it.** That's what an old manager once said about me. Only now do I understand why.

This is a philosophy I arrived at after a long, aimless stretch of teaching myself every skill I could and getting nothing out of it career-wise (mostly it just drained money — liabilities, not assets 🙃).

## 3. The question that stopped me

Then today, while I was working on a pet project, Claude Code asked me something: the agent reviewing my code had found an **unwritten convention** — how did I want to handle it?

I had no idea what an unwritten convention even was. So I went back and forth with Claude Code until I got it:

> An **unwritten convention** is a rule or convention that is **never written down** anywhere in the project. The LLM simply sees a pattern repeated across the code base — or in the surrounding context, the code right next to where it's editing — and concludes on its own that this is how the project does things.

One of the options Claude Code offered me was: **just report it and let it pass**. Meaning it clears the reviewer stage and moves on to PR → merge.

## 4. The MediatR story at work

That reminded me of a mistake LLMs make constantly.

For example, the project at my company uses **MediatR** — a .NET library where, instead of calling a service directly, every operation is wrapped into a `Command` or a `Query` and dispatched through a middleman that finds the right `Handler` to run it.

The pattern isn't bad. But for most of our project's scope it's overkill. The pain point is that engineers name their handlers badly, which makes handlers very hard to find. And there's a second naming problem: something is called a `Command` but only reads from the DB, or it's called a `Query` but writes to the DB.

So my team gradually stopped wanting to use it, and went back to writing plain service classes that are easier to trace.

And when the LLM generates code, it checks the surrounding context — sees MediatR everywhere — and writes the new code with MediatR.

That is exactly an unwritten convention. Nobody wrote down "this project uses MediatR." Nobody wrote down "we're moving away from MediatR" either. The LLM just looks at the old code and guesses. And it guessed in the opposite direction from where the team was heading.

## 5. Don't let it pass. Escalate.

So I re-prompted Claude Code and told it I **did not want unwritten conventions to pass**. They had to be escalated instead, down one of two branches:

1. **If it's a real convention** → write it out, document it, turn it into a **public convention** the LLM can see. From then on the LLM reads the rule instead of guessing.
2. **If it's an anti-pattern** (like MediatR above) → turn it into a **non-goal rule** or an **anti-pattern rule**, and **mark that code as needing refactoring**.

Over time, the set of conventions gets richer and more complete. And the tech debt slowly disappears.

Then I read the LLM's thinking, and it hit me: this is an example of an improvement loop.

## 6. Why this is a loop

Looking back, here's how the cycle runs:

```
Agent reviews the code
   └─> finds a pattern no written rule covers
        └─> does NOT let it pass, escalates
             ├─> good pattern → write it up as a rule
             └─> bad pattern  → write it up as an anti-pattern rule + mark for refactor
                  └─> on the next review, the LLM reads the new rule
                       └─> back to the top of the loop
```

Every pass, the rule set gets a little thicker. Every pass, the LLM's blind spot gets a little narrower. No single pass produces a leap. But the next one is always slightly better than the last.

That's exactly the 1% I mentioned earlier.

And the most important part: **I'm not the one sitting there inventing rules**. The loop pulls the rules out of the code base itself. All I do is decide "is this a convention, or an anti-pattern?" That's the point where a human starts stepping out of the AI's loop.

## 7. Wrapping up

I still wouldn't claim I've built a complete self-improvement loop. But at least I can now see its shape, after a long stretch of only having the idea and no idea where to start.

Turns out it isn't about doing something big. It's about this: every time the agent is willing to let something vague slide through, you stop it and make it write the thing down.

And thinking about it more, the core of this self-improvement loop is the same as it always was, long before AI. Teams always had some way to improve themselves — the retrospective at the end of each sprint is the classic example.

But back then AI wasn't everywhere, and humans had to make most of the calls. And humans are lazy and undisciplined. So most of those loops were never followed through.

Now, the grinding part is what I hand off to the agent. My part is just deciding what's right and what's wrong.

That's all it is. But you have to keep doing it.
