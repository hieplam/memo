---
id: adr-20260613-add-multilang-posts
c3-seal: 693ad11751fbb06703789470b3ef64977f744a184587cc9a7f7f6cff5b22a67b
title: add-multilang-posts
type: adr
goal: Add multilingual support to blog posts so the site can hold posts in mixed languages (Vietnamese and English), letting readers filter the list pages by language and switch between translations inside a post — without introducing i18n routing for post URLs. This ports the approved design and implementation from the sibling repo `todd.lamb` (commit 8a3c4e7) to avoid duplicating the work. Language becomes an attribute of a post (`lang`, default `vi`) plus an optional `multiLangKey` that pairs translations; URLs stay flat at `/posts/<slug>`.
status: implemented
date: "2026-06-13"
---

## Goal

Add multilingual support to blog posts so the site can hold posts in mixed languages (Vietnamese and English), letting readers filter the list pages by language and switch between translations inside a post — without introducing i18n routing for post URLs. This ports the approved design and implementation from the sibling repo `todd.lamb` (commit 8a3c4e7) to avoid duplicating the work. Language becomes an attribute of a post (`lang`, default `vi`) plus an optional `multiLangKey` that pairs translations; URLs stay flat at `/posts/<slug>`.

## Context

memo is an AstroPaper v6 static blog. Today the post schema in `src/content.config.ts` has no language field, the post-list pages (`/posts`, paginated) show every post in one stream, and post detail pages emit a single site-wide `<html lang>`. There is no way to mark a post's language, filter by it, or link a post to its translation. The sibling repo `todd.lamb` already designed and shipped this exact feature; re-deriving it here would duplicate work. Affected topology: content-collections schema (c3-101), utils (c3-105), ui-components (c3-103), pages-routing (c3-110), and layouts (c3-102). Constraint: memo currently has zero posts, so the feature must build cleanly with an empty post set and the user has chosen to port the mechanism only (no sample posts).

## Decision

Mirror the existing tag-archive mechanism rather than introduce Astro i18n routing for posts. Specifically: (1) add two optional schema fields — `lang` (enum vi|en, default "vi") and `multiLangKey` (optional string); (2) add two pure utils — `getPostLanguages` (languages present in the non-draft post set) and `getTranslationSibling` (find the paired translation by `multiLangKey` + different `lang`); (3) add a `/posts/lang/[lang]/[...page]` paginated route that reuses `paginate()` exactly like `/tags/[tag]/[...page]`; (4) add a `LangFilter` filter bar (All · Tiếng Việt · English) on the all-posts and per-language pages; (5) add a language badge to `Card.astro`; (6) add a `LangSwitch` button on post detail rendered only when a sibling exists; (7) thread an optional `lang` prop through `PostLayout` → `Layout` so post detail sets the correct per-post `<html lang>`. Separate paginated pages (not client-side JS filtering) are chosen because JS filtering only sees the current page and would break pagination as the post count grows.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-101 | component | content-collections: adds lang + multiLangKey fields to the posts Zod schema | Update component code-map/body; comply with ref-content-schema |
| c3-105 | component | utils: adds getPostLanguages.ts and getTranslationSibling.ts pure helpers | Update component code-map; comply with rule-no-console, rule-prettier-format |
| c3-103 | component | ui-components: adds LangFilter.astro and a language badge in Card.astro | Update component code-map; comply with ref-tailwind-design-system |
| c3-110 | component | pages-routing: adds /posts/lang/[lang]/[...page].astro, edits /posts/[...page].astro and post detail index.astro (+ LangSwitch.astro) | Update component code-map; comply with ref-content-schema, ref-i18n-strategy |
| c3-102 | component | layouts: Layout.astro + PostLayout.astro gain an optional lang prop for per-post <html lang> | Update component code-map; comply with ref-tailwind-design-system |
| ref-content-schema | ref | The frontmatter schema contract gains two fields and must document them | Update ref ## How to include the new fields |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-content-schema | This change adds two fields to the canonical posts Zod schema the ref governs | update-ref (add lang default "vi" + optional multiLangKey to ## How) |
| ref-i18n-strategy | New + edited routes call useTranslations/Astro.currentLocale for UI strings; feature must not break the UI-string locale strategy | comply (post lang is separate from UI locale; chrome strings stay in site locale) |
| ref-tailwind-design-system | New LangFilter, the Card badge, and LangSwitch are styled with Tailwind tokens | comply (reuse border/accent/muted-foreground tokens, no raw colors) |
| ref-og-image-generation | OG image generation is untouched by language fields | N.A - no OG image code or schema field changed |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-no-console | New .ts/.astro files must contain no console.* calls | comply (ported code has no console usage) |
| rule-prettier-format | All new/edited .ts/.astro files must pass prettier --check (double quotes, 2-space, trailing commas) | comply (run prettier --write before audit) |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| Schema | Add lang: z.enum(["vi","en"]).default("vi") and multiLangKey: z.string().optional() to posts schema | src/content.config.ts |
| Utils | Create getPostLanguages.ts (languages present via postFilter) and getTranslationSibling.ts (sibling by multiLangKey) | src/utils/getPostLanguages.ts, src/utils/getTranslationSibling.ts |
| Filter bar | Create LangFilter.astro (All · Tiếng Việt · English, active highlight) | src/components/LangFilter.astro |
| Card badge | Add 🇻🇳 VI / 🇺🇸 EN badge to card; adapt to memo's simpler Card markup (no hero grid) | src/components/Card.astro |
| Lang route | Create paginated /posts/lang/[lang]/[...page].astro mirroring tag archive | src/pages/posts/lang/[lang]/[...page].astro |
| All-posts page | Render <LangFilter active="all"> on /posts | src/pages/posts/[...page].astro |
| Switch button | Create LangSwitch.astro; render on post detail only when sibling exists | src/pages/posts/[...slug]/_components/LangSwitch.astro, src/pages/posts/[...slug]/index.astro |
| html lang | Thread optional lang prop PostLayout → Layout; set from post.data.lang | src/layouts/Layout.astro, src/layouts/PostLayout.astro |
| Docs | Update c3-101/102/103/105/110 code-maps + ref-content-schema How | c3 write / c3 set, c3 check |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - no C3 CLI/validator/schema-template change | This ADR only edits doc bodies via c3 write (component code-maps, ref-content-schema ## How); no c3x commands, validators, hints, templates, or tests are modified | c3 check passes after doc updates |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| astro check / astro build | Zod schema + TS types fail the build if a post declares an unknown lang or a util signature drifts | npm run build (CI deploy workflow) |
| prettier --check | Fails CI if new files are misformatted | rule-prettier-format |
| eslint no-console | Fails CI if console.* introduced | rule-no-console |
| c3 check | Flags doc/code drift on the touched components and ref | c3 check output |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Client-side JS filtering of rendered cards | Only filters the current paginated page; breaks as post count grows past one page — the very reason the design picked separate paginated routes |
| Astro i18n routing (/en/ URL prefix, per-locale folders) | Heavyweight; would split each post into a locale tree and change all existing post URLs, contradicting the "each post is independent, URLs stay flat" principle |
| Separate Astro content collection per language | Duplicates schema/query logic and complicates cross-language pairing; a single collection with a lang field is simpler and keeps multiLangKey pairing trivial |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Schema default breaks existing/empty post set | lang defaults to "vi" so no post needs edits; memo has zero posts so nothing regresses | npm run build succeeds with empty posts |
| Card markup drift (memo Card ≠ todd.lamb Card) | Adapt the badge to memo's actual <li class="my-6"> markup instead of pasting the hero-grid variant | Visual check + astro check |
| multiLangKey with duplicate lang picks wrong sibling | getTranslationSibling returns the first non-draft match with a different lang; documented as an authoring convention | Unit-style reasoning + getTranslationSibling source |
| Filter bar empty when only one language present | LangFilter renders All + only languages that have posts; acceptable with zero/one language | getPostLanguages filters to present langs |

## Verification

| Check | Result |
| --- | --- |
| npx astro build | Completes with no new errors beyond the pre-existing tailwind/rolldown type drift in astro.config.ts |
| npx prettier --check on changed files | All changed files formatted |
| c3 check | 0 issues after doc updates |
| Manual: add temp vi+en pair, load /posts, /posts/lang/en, post detail | Filter bar shows, badge shows, switch button appears only on paired post, <html lang> matches post |
