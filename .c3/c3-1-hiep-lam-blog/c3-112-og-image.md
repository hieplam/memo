---
id: c3-112
c3-seal: 6c45d21e969e0d3b9563a5b321853adf8ebdd28af1fb8f5e096294a977c62a4d
title: og-image
type: component
category: feature
parent: c3-1
goal: Generate static 1200x630 PNG Open Graph images at build time using Satori (JSX-to-SVG) and Sharp (SVG-to-PNG) for both the site default and per-post images, fetching the Google Sans Code font via Astro's font API.
uses:
    - ref-content-schema
    - ref-og-image-generation
---

## Goal

Generate static 1200x630 PNG Open Graph images at build time using Satori (JSX-to-SVG) and Sharp (SVG-to-PNG) for both the site default and per-post images, fetching the Google Sans Code font via Astro's font API.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | Hiep Lam Blog (c3-1) |
| Category | Feature (12) |
| Owned files | src/pages/og.png.ts, src/pages/posts/[...slug]/index.png.ts, src/utils/getFontPathByWeight.ts, src/utils/resolveDefaultOgImagePath.ts |
| Depended on by | layouts references OG image URL in head meta; search crawlers fetch OG images |

## Purpose

Owns the two Astro API route endpoints that produce PNG responses via Satori and Sharp: og.png.ts (site-level default image with site title and description) and posts/[...slug]/index.png.ts (per-post image with post title and author). Also owns the getFontPathByWeight utility that resolves font file paths from Astro fontData metadata, and resolveDefaultOgImagePath that provides the fallback OG image URL. Does NOT own layout head meta tags that reference these URLs.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Preconditions | Google Sans Code font configured in astro.config.ts fonts array and available via astro:assets fontData | c3-1 |
| Inputs | astro:assets fontData for font file resolution; post entry data (title, author) for per-post OG | c3-101 |
| State | Stateless API routes; each request generates image fresh from inputs | c3-1 |
| Shared deps | satori package for SVG generation; sharp package for PNG conversion; src/config.ts for site metadata | c3-105 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Primary path | Astro build calls GET handler, Satori renders JSX-like object tree to SVG, Sharp converts SVG to PNG buffer, returned as image/png response | c3-1 |
| Font loading | getFontPathByWeight locates font file URL from astro:assets fontData, fetched as ArrayBuffer for Satori embedFont | c3-105 |
| Per-post OG | posts/[...slug]/index.png.ts receives slug param, queries collection entry, renders post title and author in OG layout | c3-101 |
| Fallback | If per-post ogImage frontmatter field is set, layout uses that instead of the generated PNG endpoint | c3-101 |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-og-image-generation | ref | Satori JSX object structure and Sharp pipeline contract | Primary | OG image dimensions must be 1200x630; font must be embedded via embedFont:true |
| ref-content-schema | ref | ogImage frontmatter field used to override generated OG image per post | Secondary | Posts may specify ogImage in frontmatter to skip dynamic generation |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| GET /og.png | OUT | Returns 1200x630 PNG with site title and description; Content-Type: image/png | Social crawlers and layout head meta | src/pages/og.png.ts |
| GET /posts/[slug]/index.png | OUT | Returns 1200x630 PNG with post title and author; Content-Type: image/png | Social crawlers and PostLayout head meta | src/pages/posts/[...slug]/index.png.ts |
| resolveDefaultOgImagePath | OUT | Returns string URL for the default OG image used when no post ogImage is specified | src/layouts/Layout.astro | src/utils/resolveDefaultOgImagePath.ts |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Font fetch failure during build | Font file not found in astro fontData or URL resolution fails | Build throws error: Cannot find the font path | src/pages/og.png.ts change + verify build completes |
| OG image dimensions change | Changing width/height in Satori config breaks social card previews | Social media previews show cropped or stretched images | src/pages/og.png.ts change + validate with Open Graph debugger |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Generated OG PNG images | Goal section: 1200x630 PNG images generated via Satori and Sharp at build time | Post-specific title and author text | src/pages/og.png.ts + src/pages/posts/[...slug]/index.png.ts |
