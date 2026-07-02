---
id: adr-20260702-add-mermaid-diagram-rendering
c3-seal: bc2569cb67d1cc01c91b841ed3ad0606ad089a1f7de3dcc2ff28f9fa363add30
title: add-mermaid-diagram-rendering
type: adr
goal: Render fenced ` ```mermaid ` code blocks in published blog posts as live SVG diagrams instead of Shiki-highlighted source text. The change adds a lazy, client-side Mermaid renderer that activates only on pages containing diagrams, matches the site's light/dark theme, and survives ClientRouter view-transition navigation.
status: implemented
date: "2026-07-02"
---

## Goal

Render fenced ` ```mermaid ` code blocks in published blog posts as live SVG diagrams instead of Shiki-highlighted source text. The change adds a lazy, client-side Mermaid renderer that activates only on pages containing diagrams, matches the site's light/dark theme, and survives ClientRouter view-transition navigation.

## Context

Today a ` ```mermaid ` fence is passed to Shiki like any other code block and emitted as `<pre class="astro-code" data-language="mermaid">` containing highlighted source spans (verified in `dist/posts/prompting-anatomy-and-practice-vi/index.html`). Readers see raw `flowchart LR ...` text, not a diagram — this is the exact bug reported for the published `prompting-anatomy-and-practice-vi` post. Three posts author diagrams (14 fences total): `prompting-anatomy-and-practice.md`, `prompting-anatomy-and-practice-vi.md`, `agentic-ai-failure-modes.md`. Constraints: the site is a fully static Astro 6 build deployed to GitHub Pages under base `/memo`; it uses `ClientRouter` view transitions (so post-processing must re-run on `astro:page-load`); it toggles light/dark via a `dark` class + `data-theme` on `<html>`; CI runs `bun install --frozen-lockfile`, `astro check` (type-check), eslint (`rule-no-console`), and prettier (`rule-prettier-format`). Affected topology: `c3-102` layouts (owns client scripts imported by `Layout.astro`, e.g. `src/scripts/theme.ts`), `c3-104` styles (`global.css`), `c3-110` pages-routing (the post-detail inline post-processing script), and `c3-106` ci-release (the new dependency must pass frozen-lockfile install + build).

## Decision

Add `src/scripts/mermaid.ts`, a bundled client module imported once in `Layout.astro` alongside `theme.ts`. On `astro:page-load` it queries `pre[data-language="mermaid"]`; only when at least one exists does it dynamically `import("mermaid")` (the heavy library therefore never loads on the ~55 diagram-free posts). For each block it reconstructs the pristine diagram source from `code.textContent` (Shiki emits one `<span class="line">` per source line joined by literal `\n`, and HTML entities decode back through `textContent` — verified against built HTML), replaces the `<pre>` with a `<div class="mermaid">` holding that source, and calls `mermaid.run()`. The Mermaid theme is chosen from the current `dark` class; a `MutationObserver` on `<html>`'s class re-renders from the stored source when the reader toggles theme. `mermaid` is added as a real dependency (not a CDN import) so `astro check` types it and the build stays self-contained and offline. This wins over build-time rendering and raw-HTML remark transforms because it needs no headless browser in CI and is empirically verifiable against this repo's actual Shiki output.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-102 | component | Owns the new src/scripts/mermaid.ts client renderer and imports it in Layout.astro, extending its "structured content rendering" and theme-init responsibility | Confirm code-map adds src/scripts/mermaid.ts; Purpose/Foundational Flow mention the diagram renderer; comply with ref-tailwind-design-system, rule-no-console, rule-prettier-format |
| c3-104 | component | global.css gains .mermaid presentation rules (centering, responsive SVG, overflow) | Confirm ref-tailwind-design-system compliance (diagram surface reads theme via dark/tokens); note global.css ownership of .mermaid |
| c3-110 | component | The post-detail inline post-processing script (src/pages/posts/[...slug]/index.astro) must exclude pre[data-language="mermaid"] from the copy-button pass so diagrams get no stray "Copy" button | Comply with rule-no-console, rule-prettier-format; no route/contract change |
| c3-106 | component | A new mermaid runtime dependency must install under bun install --frozen-lockfile and build within the CI/deploy timeout | Confirm bun.lock updated and bun run build stays green; no workflow file change |
| c3-1 | container | Parent-delta checkpoint: no new component and no responsibility shift (static build + GitHub Pages deploy unchanged) | Verify Components list and Responsibilities need no edit (no-delta with evidence) |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-tailwind-design-system | Diagrams are a new visible surface that must switch with the site's light/dark theme like every other element; the renderer selects the Mermaid theme from the dark class and re-renders on toggle, and .mermaid CSS must not hardcode colors that break either palette | comply |
| ref-content-schema | Mermaid is an in-body fenced code block, not a frontmatter field, so the post Zod schema contract is untouched | N.A - no frontmatter/schema change |
| ref-i18n-strategy | Cited by c3-110, whose post-detail page this ADR edits for the copy-button guard; that edit adds no user-visible string and touches no locale table | N.A - no i18n string or locale change |
| ref-og-image-generation | Cited by c3-112; surfaced only because the container c3-1 is in the affected set for the parent-delta checkpoint, but the Satori/Sharp OG pipeline is untouched | N.A - no OG image generation change |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-no-console | The new src/scripts/mermaid.ts and the edited inline script are production TypeScript/Astro; no console.* may ship, so render errors are handled without console output | comply |
| rule-prettier-format | New .ts plus edited .astro and .css files must match the project Prettier config or format:check fails CI | comply (run bun run format) |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| Renderer | New src/scripts/mermaid.ts: guarded lazy import("mermaid"), reconstruct source from code.textContent, swap <pre>→<div class="mermaid">, theme from dark class, re-render on astro:page-load + <html> class MutationObserver | src/scripts/mermaid.ts |
| Wiring | Import @/scripts/mermaid in Layout.astro next to @/scripts/theme | src/layouts/Layout.astro |
| Styles | Add .mermaid rules to global.css (flex-center, svg { max-width:100%; height:auto }, overflow-x auto) | src/styles/global.css |
| Copy buttons | In src/pages/posts/[...slug]/index.astro skip pre[data-language="mermaid"] in attachCopyButtons | src/pages/posts/[...slug]/index.astro |
| Dependency | bun add mermaid; commit package.json + bun.lock | package.json, bun.lock |
| C3 docs | Update c3-102 code-map + body, c3-104 body; c3x check green | c3x read c3-102 / c3-104 |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| code-map (c3-102) | Add src/scripts/mermaid.ts to c3-102 code references so the renderer is owned, not uncharted | c3x lookup src/scripts/mermaid.ts resolves to c3-102 |
| c3-102 body | Purpose + Foundational Flow note the client diagram renderer and its theme/view-transition lifecycle | c3x read c3-102 --full |
| c3-104 body | Purpose/Contract note global.css ownership of .mermaid diagram presentation | c3x read c3-104 --full |
| Consistency | Docs match code after edits | c3x check reports no issues for c3-102/c3-104 |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| bun run build (astro check + astro build) | Type-checks mermaid.ts and the mermaid import; fails on type/import error | .github/workflows/ci.yml, deploy.yml; local build log |
| bun run lint (eslint) | Fails on any console.* (rule-no-console) in new/edited source | .github/workflows/ci.yml |
| bun run format:check (prettier) | Fails on unformatted new/edited files (rule-prettier-format) | .github/workflows/ci.yml |
| c3x check | Flags drift between mermaid.ts/global.css and c3-102/c3-104 docs + code-map | c3x check output |
| Playwright render check | Asserts each pre[data-language="mermaid"] becomes a rendered .mermaid svg in light and dark on bun run preview | captured screenshots |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Build-time rendering via rehype-mermaid (Playwright/Puppeteer) | Requires a headless browser inside the bun run build step; the oven-sh/setup-bun CI/deploy runners have no browser and a 3–5 min timeout — heavy and brittle for GitHub Pages CI |
| Remark plugin rewriting the fence to raw <div class="mermaid"> at build | Depends on this repo's custom unified() processor reliably passing raw-HTML mdast nodes through remark-rehype; unverified here, and client reconstruction from Shiki output is empirically confirmed against built HTML |
| Load mermaid eagerly/globally on every page | Mermaid is a large library; eager loading penalizes the ~55 diagram-free posts. A presence-guarded lazy import() keeps it off those pages |
| CDN import() of mermaid from jsDelivr (the offered alternative) | Adds a third-party runtime request + availability dependency and defeats astro check typing and offline builds; a bundled dependency is type-checked and self-contained |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Source reconstruction drops entities/whitespace → diagram fails to parse | Read code.textContent (decodes &#x3C;→<, preserves per-line \n), verified against dist HTML | Playwright screenshot of all 14 diagrams rendered |
| Copy button attaches to a mermaid <pre> before replacement | Exclude data-language="mermaid" in attachCopyButtons | DOM/screenshot check — no Copy button on diagrams |
| View-transition navigation leaves later posts unrendered | Render on astro:page-load (fires on initial load and every navigation) | Playwright navigate post→post, assert .mermaid svg |
| Theme toggle leaves diagram in stale colors | MutationObserver on <html> class re-renders from stored source with new Mermaid theme | Toggle theme in Playwright, screenshot both palettes |
| New dependency breaks frozen-lockfile CI | bun add mermaid updates bun.lock; commit lockfile with package.json | bun install --frozen-lockfile + bun run build locally |

## Verification

| Check | Result |
| --- | --- |
| bun run build | Exit 0 (astro check + astro build + pagefind) |
| bun run lint | 0 errors |
| bun run format:check | Passes |
| c3x check | No issues for c3-102 / c3-104 |
| Playwright render (light + dark) on bun run preview | Every diagram in the 3 mermaid posts shows a .mermaid svg; screenshots captured as PR evidence |
| Audit grep of dist/ | No post leaves a raw pre[data-language="mermaid"]; all become .mermaid svg |
