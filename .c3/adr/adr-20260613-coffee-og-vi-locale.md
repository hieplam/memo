---
id: adr-20260613-coffee-og-vi-locale
c3-seal: b5bab2d0d5ac9795b828f00955b16cff58d189de0b6edbe1817e806ce845ba58
title: coffee-og-vi-locale
type: adr
goal: |-
    Bring two surfaces in line with the coffee brand established by the previous
    change: (a) re-color the Satori-generated Open Graph share images from their
    monochrome black/white scheme to the Latte palette (cream paper, espresso ink,
    cinnamon accent), and (b) add a complete Vietnamese locale file so the UI chrome
    renders in Vietnamese for VI readers instead of silently falling back to English.
status: implemented
date: "2026-06-13"
---

## Goal

Bring two surfaces in line with the coffee brand established by the previous
change: (a) re-color the Satori-generated Open Graph share images from their
monochrome black/white scheme to the Latte palette (cream paper, espresso ink,
cinnamon accent), and (b) add a complete Vietnamese locale file so the UI chrome
renders in Vietnamese for VI readers instead of silently falling back to English.

## Context

OG images are generated at build time by two standalone Satori templates
(src/pages/og.png.ts for the site default, src/pages/posts/[...slug]/index.png.ts
per post). Both hardcode `#fefbfb` backgrounds, `4px solid #000` borders, and an
`#ecebeb` shadow card — a stark black-on-white card that now clashes with the
warm coffee identity of every other surface. Separately, the i18n system
(src/i18n) discovers locale files via import.meta.glob and falls back to English;
only src/i18n/lang/en.ts exists, so a VI reader sees English nav/labels/footer
even though the post content is Vietnamese. The UIStrings interface already makes
every locale a compile-time contract. Affected topology: c3-112 (og-image),
c3-110 (pages-routing, where the route files live), c3-111 (i18n).

## Decision

1. **Warm OG templates** — in both Satori templates, swap the hardcoded colors to
the Latte tokens: background/card `#f8f3ea`, shadow card `#ece3d7`, borders
`4px solid #312822` (espresso), root text color `#312822`, and color the
bottom metadata row (hostname / author / site title) in cinnamon `#9a5328`.
Keep the Google Sans Code mono font, layout, dimensions, and pipeline
unchanged — only colors change.
2. **Vietnamese locale** — add src/i18n/lang/vi.ts implementing the full
UIStrings interface in Vietnamese, picked up automatically by the existing
import.meta.glob loader; no changes to useTranslations or any component.

This fits because OG color is presentation-only inside the existing pipeline
(ref-og-image-generation is about the shared generation contract, not the
palette), and the i18n architecture was explicitly designed so a new locale is a
single new file with zero component edits.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-112 | component | og-image: Satori templates re-colored to the Latte palette | Comply with ref-og-image-generation |
| c3-110 | component | pages-routing: the two .png.ts route files are edited (colors only) | Review — no routing/behavior change |
| c3-111 | component | i18n: new vi.ts locale added implementing UIStrings | Comply with ref-i18n-strategy |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-og-image-generation | Both OG images must keep being produced by the same build-time Satori+Sharp pipeline with consistent dimensions and font; only colors change | comply |
| ref-i18n-strategy | The new locale must implement the UIStrings interface as a typed TS module discovered by import.meta.glob and consumed via useTranslations | comply |
| ref-content-schema | The per-post OG template reads frontmatter fields (title, author) defined by the content schema; this change reads the same fields without modifying the schema | review |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-no-console | Edited TS templates and the new locale must contain no console.* calls | comply |
| rule-prettier-format | All edited/new TS must be Prettier-clean | comply |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| og-image | Swap colors to Latte palette in the site-default template | src/pages/og.png.ts |
| og-image | Swap colors to Latte palette in the per-post template | src/pages/posts/[...slug]/index.png.ts |
| i18n | Add full Vietnamese UIStrings implementation | src/i18n/lang/vi.ts |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - no C3 CLI/validator/schema/template change; application code only | N.A - documentation-only ADR | N.A |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| astro check | Type-checks vi.ts against UIStrings; missing/extra keys fail | bun run astro check -> 0 errors |
| astro build | Renders both OG templates; a Satori error fails the build | dist OG PNGs produced |
| prettier --check | Fails on formatting drift (rule-prettier-format) | bun run format:check |
| eslint | Flags console usage (rule-no-console) | bun run lint |
| Browser/image review | Visual confirm warm OG card and Vietnamese UI on VI routes | agent-browser screenshots |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Drive OG colors from theme.css tokens at build time | Satori cannot read CSS custom properties; tokens must be inlined as literals in the template, so hardcoded Latte hex values are the correct approach |
| Make the OG card dark (Mocha) instead of light | OG previews render on varied external backgrounds; the light Latte card is higher-contrast and more legible as a share thumbnail |
| Auto-translate vi.ts via a script at build | Adds tooling and produces lower-quality strings; a hand-written locale file is the project's established, reviewable pattern |
| Localize OG image text per post language | Out of scope; OG text is title/author/site, already content-derived; only the palette is in scope here |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Cinnamon accent on cream drops OG metadata legibility | #9a5328 on #f8f3ea is the site link pair, already verified 5.2:1 (>= 4.5) | Prior contrast check; visual review |
| vi.ts drifts from UIStrings (missing/renamed key) | UIStrings interface enforces the full key set at compile time | bun run astro check |
| Untranslated or wrong Vietnamese strings | Hand-authored, reviewed against en.ts key-by-key | Visual review on VI routes |

## Verification

| Check | Result |
| --- | --- |
| bun run astro check | 0 errors, 0 warnings |
| bun run lint | passes |
| bun run format:check | passes |
| bun run build | succeeds; warmed OG PNGs in dist |
| c3 check | no issues |
| agent-browser review | OG card shows cream/espresso/cinnamon; VI routes show Vietnamese nav/labels/footer |
