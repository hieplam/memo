---
title: "Compile Once, Maintain Forever: Karpathy's LLM Wiki Pattern"
description: "Andrej Karpathy's 'LLM Wiki' is a prose pattern, not a product — a few paragraphs pasted into a coding agent so it compiles raw sources into a cross-linked wiki once, then keeps it current, instead of re-deriving answers from a RAG corpus on every query."
pubDatetime: 2026-07-01T00:10:00Z
lang: en
tags:
  - llm
  - knowledge-management
  - ai-agents
  - karpathy
multiLangKey: "karpathy-llm-wiki"
---

## TL;DR

- Stop treating documents as a RAG corpus the LLM re-reads on every question. Instead, let the LLM **compile** raw sources once into a structured, cross-linked wiki and then keep it current — ingesting new sources, answering with citations, and linting for contradictions.
- The pattern rests on a **three-layer structure**: immutable raw sources, an LLM-owned wiki, and a human-authored schema/config that turns a generic chatbot into a disciplined maintainer.
- Three workflows do all the work: **ingest** (one source ripples across ~10–15 existing pages), **query** (answers with citations, and ideally files new findings back), and **lint** (catches contradictions, staleness, and orphan pages).
- The human curates sources and asks good questions; the LLM does the tedious maintenance that makes humans abandon wikis. It's a software-2.0-era realization of Vannevar Bush's 1945 _Memex_.
- It's a pattern, not a guarantee — quality depends entirely on the schema/config and the discipline of the agent following it, and the lint pass is load-bearing, not optional.

---

## 1. What it actually is

The **LLM Wiki** is _not a product and not a codebase_. It's a **prose pattern** — a few paragraphs of instructions you paste into a coding agent (Claude Code, Cursor, Codex, Gemini CLI, …) so the agent builds and maintains a personal knowledge base for you.

It grew out of a Karpathy tweet on "LLM knowledge bases": he noticed a growing fraction of his own token throughput was going _not_ into manipulating code, but into manipulating **knowledge** — building durable, structured notes for research topics. Two days later he posted the `llm-wiki.md` gist describing the pattern concretely.

## 2. The core idea: wiki, not RAG

The pattern is best understood as a contrast with the default way people use LLMs over documents.

**Default = RAG (retrieve-and-answer):**

- You upload a pile of files.
- On _every_ query, the LLM retrieves relevant chunks and synthesizes an answer from scratch.
- The knowledge is never _kept_ — the model re-discovers the same facts again and again, and nothing compounds between sessions.

**LLM Wiki = compile-once, maintain-forever:**

- Raw sources are **compiled once** into structured Markdown pages.
- Those pages are then _kept current_ as new sources arrive.
- The wiki is a **persistent, compounding artifact** — it gets richer and better cross-linked over time instead of evaporating.

The crisp framing: _with RAG the LLM rediscovers knowledge on every question; with a wiki the knowledge is already distilled and waiting._

## 3. Three-layer structure

| Layer                  | Mutability    | Owner         | Contents                                                                                                                                               |
| ---------------------- | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`raw/` — sources**   | immutable     | human curates | articles, papers, transcripts, docs. The LLM _reads_ but never edits these; they're the source of truth.                                               |
| **`wiki/` — the wiki** | LLM-owned     | the LLM       | summaries, **entity pages**, **concept pages**, **comparison pages**, and an **overview**. You almost never hand-edit.                                 |
| **schema / config**    | human-defined | human         | a doc that defines the wiki's structure, naming conventions, and workflows. This is what turns a generic chatbot into a _disciplined wiki maintainer_. |

Two bookkeeping files keep the system coherent:

- **`index.md`** — a content catalog: every wiki page with a one-line summary, grouped by category. The LLM reads this **first** when answering a query, so it knows what already exists.
- **`log.md`** — an append-only, chronological record of every ingest / query / lint pass. Gives the LLM recent context and lets you see how the wiki evolved.

## 4. The three workflows

### Ingest

Drop a new source into `raw/`. The LLM:

1. reads it,
2. extracts the durable knowledge,
3. **updates ~10–15 existing pages** — a single source ripples across many pages via cross-references rather than landing in one place,
4. appends an entry to `log.md`.

The "one source touches many pages" behavior is the whole point — it's what builds the interlinked graph.

### Query (Q&A)

Ask a question against the wiki. The LLM reads `index.md`, searches the relevant pages, and synthesizes a **cited** answer. Ideally it then _files valuable new findings back_ into the wiki as new pages — so even asking questions makes the wiki grow.

### Lint

Periodic health check of the whole graph. The LLM hunts for:

- contradictions between pages,
- stale / outdated claims,
- orphan pages (nothing links to them),
- missing cross-references.

Linting is what keeps a _growing_ wiki from rotting into an inconsistent mess.

## 5. Why this works (and why now)

The honest reason humans abandon wikis is **maintenance is tedious** — nobody wants to keep fixing cross-links, reconciling contradictions, and re-summarizing as new material arrives.

LLMs don't get bored. So the division of labor flips:

- **Human:** curate good sources, ask good questions. (Low volume, high judgment.)
- **LLM:** everything else — extraction, cross-linking, index upkeep, contradiction detection, summarization. (High volume, mechanical-but-careful.)

Karpathy explicitly frames this as finally delivering **Vannevar Bush's 1945 _Memex_** — a personal store of documents with associative trails between them. The Memex always failed on the _maintenance labor_ problem; the LLM is the labor that makes it real.

## 6. Ecosystem

Because the pattern is just prose + a directory convention, lots of people built tooling around it:

- **`nashsu/llm_wiki`** — cross-platform desktop app that turns documents into an interlinked KB automatically.
- **`lucasastorian/llmwiki`** — open-source impl; upload docs, connect a Claude account via MCP, it writes the wiki.
- **`Pratiyush/llm-wiki`** — builds a wiki from your Claude Code / Codex / Copilot / Cursor / Gemini sessions.
- **`Astro-Han/karpathy-llm-wiki`** — Agent-Skills-compatible version (Claude Code / Cursor / Codex): ingest → cite → lint.
- An **Obsidian plugin** ("Karpathy LLM Wiki") for viewing/maintaining the wiki in Obsidian.
- Tutorials (Data Science Dojo) and retrospectives ("one month in: mostly yes").

## 7. Honest caveats

- It's a **pattern, not a guarantee** — quality depends entirely on your schema/config and the discipline of the agent following it.
- "Compile once" front-loads cost: ingest is more expensive than a RAG query; it pays off only if you _re-query the same knowledge many times_.
- The wiki can still drift or hallucinate; the **lint pass is load-bearing**, not optional.
- For a one-off question over a few docs, plain RAG is simpler. The wiki wins for a **long-lived research interest** you return to repeatedly.

## 8. A familiar shape: personal research notes as a manual instance

A personal research wiki — the kind of durable, bilingual notes many people keep on topics they return to — is essentially a **manual instance** of the LLM-Wiki pattern already:

- raw sources → conversations / articles you read.
- durable notes → pages that compound over time, cross-referencing earlier entries.
- a house style doc → the schema (mask PII, use personas, keep history), even before adopting the gist's exact conventions.

The gist's contribution over an informal version of this is the **rigor**: an explicit `index.md`, an append-only `log.md`, and a recurring **lint** step to catch contradictions and orphans. Adopting those three would bring an ad-hoc personal wiki much closer to the disciplined pattern Karpathy describes.

---

### Sources

- Karpathy gist — `llm-wiki.md`: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
- Karpathy tweet on LLM knowledge bases: <https://x.com/karpathy/status/2039805659525644595>
- Data Science Dojo tutorial: <https://datasciencedojo.com/blog/llm-wiki-tutorial/>
- "Built it twice — code vs .md" (Towards AI): <https://pub.towardsai.net/i-built-karpathys-llm-wiki-twice-once-as-code-once-as-a-md-heres-what-each-one-gives-up-08b31170999a>
- "Is Karpathy's viral LLM wiki helpful? — one month in" (R&D World): <https://www.rdworldonline.com/is-karpathys-viral-llm-wiki-helpful-mostly-yes-one-month-in/>
- Implementations: <https://github.com/nashsu/llm_wiki> · <https://github.com/lucasastorian/llmwiki> · <https://github.com/Pratiyush/llm-wiki> · <https://github.com/Astro-Han/karpathy-llm-wiki>

> **Key idea:** with RAG the LLM rediscovers knowledge on every question; with a wiki, the knowledge is already distilled and waiting — the LLM just has to keep it that way.
