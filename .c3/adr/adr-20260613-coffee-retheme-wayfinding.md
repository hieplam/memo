---
id: adr-20260613-coffee-retheme-wayfinding
c3-seal: d2b74ab76d16fdf48217e828623a73d4ad7ff7b85600ec6c981d3ec3f298da2d
title: coffee-retheme-wayfinding
type: adr
goal: |-
    Re-theme the blog to a warm, low-contrast "coffee" visual identity (Latte light
    / Mocha dark, OKLCH tokens, a reading serif for body and mono only for code/
    labels) and add end-of-article reading wayfinding so a reader who finishes one
    post is offered a second worthwhile post in the same language, matched by shared
    tags, plus a calm subscribe (RSS) prompt. The decision being authorized is (a)
    replacing the bright blue/orange palette and monospace-everywhere typography with
    the coffee system, and (b) introducing a tag-based RelatedPosts affordance that
    sits alongside the existing chronological AdjacentPostNav.
status: implemented
date: "2026-06-13"
---

## Goal

Re-theme the blog to a warm, low-contrast "coffee" visual identity (Latte light
/ Mocha dark, OKLCH tokens, a reading serif for body and mono only for code/
labels) and add end-of-article reading wayfinding so a reader who finishes one
post is offered a second worthwhile post in the same language, matched by shared
tags, plus a calm subscribe (RSS) prompt. The decision being authorized is (a)
replacing the bright blue/orange palette and monospace-everywhere typography with
the coffee system, and (b) introducing a tag-based RelatedPosts affordance that
sits alongside the existing chronological AdjacentPostNav.

## Context

The site (Astro 6 static blog, AstroPaper v6 base) currently ships a bright
blue-accent light theme and an orange-accent navy dark theme, with Google Sans
Code (monospace) applied to all text via `font-app` on `<body>`. The owner wants
a "chill, comfortable, coffee" feel and explicitly rejects colorful, high-
contrast, bright, and hacker/terminal aesthetics — which the current bright
accents and all-mono body work against, and which also makes long-form reading
less comfortable. Separately, the post page ends with tags, ShareLinks, and a
chronological `AdjacentPostNav` (prev/next by publish order); there is no
mechanism that surfaces a *topically related* next read in the reader's
language, which is the stated activation goal (read one post to the end, click
into a second). Affected topology: styles (c3-104), layouts (c3-102), ui-
components (c3-103), utils (c3-105), i18n (c3-111), pages-routing (c3-110).

## Decision

Two coordinated moves in one change set:

1. **Coffee re-theme** — rewrite the color tokens in `src/styles/theme.css`
(Latte light, Mocha dark) in OKLCH with WCAG-verified contrast; add a
`--color-surface` token and a `--font-reading` (Spectral) token; register
Spectral via the existing Astro Fonts API in `astro.config.ts` and load it in
`Layout.astro`; switch `<body>` from `font-app` to `font-reading`; keep mono
(`font-app`) on code and small labels; swap Shiki themes to warm Gruvbox-soft.
2. **Reading wayfinding** — add a pure util `getRelatedPosts` (same-language,
ranked by shared-tag count, recency tiebreak, excludes self + translation
sibling, falls back to recent same-language posts), a presentational
`RelatedPosts.astro` component on a `--surface` panel reusing Card link
patterns and the i18n system, and wire it into the post route after
`AdjacentPostNav` with a subtle RSS subscribe line.

This fits because the project's design system is token-first (a palette change is
a `theme.css` edit, no per-component churn) and its post utilities are pure
functions composed in page frontmatter, so a new `getRelatedPosts` follows the
exact established shape of `getSortedPosts`/`getTranslationSibling`.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-104 | component | styles: color tokens, reading-serif token, warm code themes rewritten in theme.css/typography.css | Comply with ref-tailwind-design-system |
| c3-102 | component | layouts: Layout.astro loads Spectral font and switches body base font; post route renders RelatedPosts | Comply with ref-tailwind-design-system |
| c3-103 | component | ui-components: new presentational RelatedPosts.astro component added | Comply with ref-tailwind-design-system; reuse Card patterns |
| c3-105 | component | utils: new pure util getRelatedPosts.ts added | Comply with rule-no-console, rule-prettier-format |
| c3-111 | component | i18n: new post.* UI strings (keepReading, related heading, subscribe) added to types.ts + en.ts | Comply with ref-i18n-strategy |
| c3-110 | component | pages-routing: posts/[...slug]/index.astro composes related posts in frontmatter | Comply with ref-i18n-strategy |
| c3-112 | component | og-image: OG generators reference the mono font key; verify still resolves after adding Spectral | Review only — no behavior change intended |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-tailwind-design-system | All color/theme usage must flow through CSS custom properties in theme.css consumed via Tailwind utilities with data-theme switching; the re-theme and the new --color-surface token must follow this | comply |
| ref-i18n-strategy | New user-visible strings must be added to the UIStrings interface and every lang/*.ts and accessed via useTranslations, not hardcoded in components | comply |
| ref-content-schema | getRelatedPosts and the post route read frontmatter fields (tags, lang, multiLangKey) defined by the content collection schema; the wayfinding consumes these fields without changing the schema | comply |
| ref-og-image-generation | Adding a second font to the Astro fonts array must not break the OG generators that read the mono font key from fontData | review |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-no-console | New TS util and Astro component must contain no console.* calls | comply |
| rule-prettier-format | All new/edited TS, Astro, CSS must be Prettier-clean so diffs are semantic-only | comply |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| styles | Rewrite color tokens + add --color-surface, --font-reading in theme.css; mono on code in typography.css | src/styles/theme.css, src/styles/typography.css |
| config | Add Spectral font; swap Shiki to gruvbox-light-soft/gruvbox-dark-soft | astro.config.ts |
| layouts | Load Spectral Font + preload; body font-app -> font-reading | src/layouts/Layout.astro |
| utils | Add getRelatedPosts(post, allPosts, limit) pure function | src/utils/getRelatedPosts.ts |
| i18n | Add post.keepReading/relatedDesc/subscribe keys | src/i18n/types.ts, src/i18n/lang/en.ts |
| ui-components | Add RelatedPosts.astro (surface panel, related list, RSS line) | src/components/RelatedPosts.astro |
| pages-routing | Compute related posts, render RelatedPosts after AdjacentPostNav | src/pages/posts/[...slug]/index.astro |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - no C3 CLI/validator/schema/template change; this is application code only | N.A - documentation-only ADR plus a new component entity registered via c3 add | N.A |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| astro check | Type-checks new util signature, i18n UIStrings keys across all lang files, and component props | bun run astro check -> 0 errors |
| prettier --check | Fails CI if new files violate formatting (rule-prettier-format) | bun run format:check |
| eslint | Flags console usage and lint issues (rule-no-console) | bun run lint |
| c3 check | Validates docs match topology after registering RelatedPosts component | c3 check -> no errors |
| Browser review | Visual verification of both themes + related panel at desktop/mobile | agent-browser screenshots |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Cream warm-neutral light bg only, keep mono everywhere | Mono body harms long-form reading comfort and reads as the "developer/terminal" aesthetic the owner explicitly rejected |
| Extend existing AdjacentPostNav to show related instead of a new component | AdjacentPostNav is chronological prev/next by design; overloading it with tag logic conflates two affordances and muddies its contract |
| Compute related posts with an external similarity library | Overkill for a static blog; shared-tag count is sufficient, dependency-free, and matches the existing pure-util convention |
| Hardcode the "Keep reading" heading in the component | Violates ref-i18n-strategy; breaks the compile-time locale contract |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Low-contrast coffee palette drops below WCAG AA | All token pairs pre-computed in OKLCH and checked >= 4.5:1 for body before authoring | Contrast script output (ink/bg 13.0, accent/bg 5.2 light; milk/bg 12.5, accent/bg 8.3 dark) |
| Adding Spectral breaks OG image generation (reads mono font key) | Keep Google Sans Code in the fonts array; OG key unchanged | OG endpoint renders; build succeeds |
| RelatedPosts empty when a post has only unique tags | Fallback to most-recent same-language posts excluding self/sibling | Util returns up to limit on tag-less posts; verified in browser |
| New i18n keys missing from a future locale file | UIStrings interface makes missing keys a compile error | bun run astro check |

## Verification

| Check | Result |
| --- | --- |
| bun run astro check | 0 errors, 0 warnings |
| bun run lint | passes (no console, no lint errors) |
| bun run format:check | passes (Prettier clean) |
| c3 check | no errors after registering RelatedPosts component |
| agent-browser visual review | Related panel renders with second post + RSS line in both Latte/Mocha at desktop and mobile widths |
