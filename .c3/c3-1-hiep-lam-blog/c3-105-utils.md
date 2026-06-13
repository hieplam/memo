---
id: c3-105
c3-seal: e038b49669ac9690c091f81f0d2aacb0d3c9c01ff3c11fa1794d03e071f35249
title: utils
type: component
category: foundation
parent: c3-1
goal: Provide pure TypeScript helper functions for post filtering, sorting, tag extraction, slug generation, URL path resolution, and font path lookup used across pages and OG image generation.
uses:
    - rule-no-console
---

## Goal

Provide pure TypeScript helper functions for post filtering, sorting, tag extraction, slug generation, URL path resolution, and font path lookup used across pages and OG image generation.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | Hiep Lam Blog (c3-1) |
| Category | Foundation (05) |
| Owned files | src/utils/.ts, src/utils/transformers/.js |
| Depended on by | pages-routing uses postFilter, getSortedPosts, getUniqueTags, getPostPaths; og-image uses getFontPathByWeight |

## Purpose

Owns the following utilities: postFilter.ts (excludes drafts and future-dated posts), getSortedPosts.ts (sorts posts by pubDatetime desc), getUniqueTags.ts (extracts deduplicated tag list), getPostPaths.ts (generates static path params for post routes), slugify.ts (converts titles to URL-safe slugs), withBase.ts (prepends base URL), resolveDefaultOgImagePath.ts (resolves fallback OG image), getFontPathByWeight.ts (locates font file by weight for Satori), toTransitionName.ts (generates view transition names), transformers/fileName.js (Shiki code block filename transformer). Does NOT own route templates or content schemas.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Preconditions | Content collections must be available before utils are called at build time | c3-101 |
| Inputs | Array of CollectionEntry<posts> passed to filter/sort/tag utilities | c3-101 |
| State | Stateless pure functions; no module-level mutable state | c3-1 |
| Shared deps | src/config.ts for scheduledPostMargin used by postFilter; astro:assets fontData for getFontPathByWeight | c3-1 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Primary path | Pages import getSortedPosts and postFilter, pass collection entries, receive filtered sorted array for rendering | c3-101 |
| Tag extraction | getUniqueTags deduplicates tags across all posts and returns sorted list for tags index page | c3-101 |
| Static paths | getPostPaths generates params array consumed by Astro getStaticPaths for post detail routes | c3-101 |
| OG font | getFontPathByWeight searches fontData metadata to find the woff/ttf file matching a given weight for Satori | c3-1 |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| rule-no-console | rule | no console.log or console.error calls in utility functions | Primary | All utils must use type-safe returns or throw typed errors instead of logging |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| postFilter | OUT | Returns posts array with drafts and future-dated entries removed | src/pages/**/*.astro | src/utils/postFilter.ts |
| getSortedPosts | OUT | Returns posts sorted by pubDatetime descending with drafts excluded | src/pages/**/*.astro | src/utils/getSortedPosts.ts |
| getPostPaths | OUT | Returns StaticPathEntry array for use in Astro getStaticPaths | src/pages/posts/[...slug]/index.astro | src/utils/getPostPaths.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| postFilter logic error excludes live posts | Changing scheduledPostMargin calculation in postFilter | Missing posts in built site | src/utils/postFilter.ts change + verify post count in dist/ |
| getSortedPosts returns wrong order | Changing sort comparator | Posts rendered in wrong order on list pages | src/utils/getSortedPosts.ts change + manual review of index page |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Post filter and sort results | Goal section: pure functions for filtering and sorting post entries | None, deterministic output | src/utils/postFilter.ts + src/utils/getSortedPosts.ts |
