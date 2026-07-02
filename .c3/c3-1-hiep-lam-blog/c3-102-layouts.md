---
id: c3-102
c3-seal: 8b5358e953805eb477f02b36d4e6d03b90eaa783b9ccf95df6c6cb7439b3517e
title: layouts
type: component
category: foundation
parent: c3-1
goal: Provide the base HTML shell and post-specific wrapper that all Astro pages compose from, managing document head meta, theme initialization, and structured content rendering.
uses:
    - ref-tailwind-design-system
---

## Goal

Provide the base HTML shell and post-specific wrapper that all Astro pages compose from, managing document head meta, theme initialization, and structured content rendering.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | Hiep Lam Blog (c3-1) |
| Category | Foundation (02) |
| Owned files | src/layouts/Layout.astro, src/layouts/PostLayout.astro, src/scripts/mermaid.ts |
| Depended on by | All pages in src/pages/ import Layout or PostLayout |

## Purpose

Owns the base Layout.astro (document head, SEO meta, canonical URL, OG tags, viewport, theme init script, body wrapper) and PostLayout.astro (post-specific title, author, datetime, tags, breadcrumb, adjacent navigation, share links, edit link). Also owns the client-side scripts Layout.astro loads: src/scripts/theme.ts (light/dark preference) and src/scripts/mermaid.ts (lazily renders ```mermaid fenced code blocks into inline SVG diagrams, theme-aware, re-running after each ClientRouter view transition). Does NOT own individual UI widgets or content collection queries.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Preconditions | Theme script must run before page render to avoid flash of unstyled content | c3-1 |
| Inputs | Props: title, description, ogImage, canonicalURL, pubDatetime, modDatetime, author, tags, post slug | c3-1 |
| State | Theme preference stored in localStorage via src/scripts/theme.ts | c3-1 |
| Shared deps | src/config.ts for site metadata defaults; ui-components for Header, Footer | c3-1 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Primary path | Page imports Layout, passes props, Layout renders document head with SEO meta and wraps slot | c3-1 |
| Post path | Post page imports PostLayout which extends Layout with post-specific metadata and navigation components | c3-1 |
| OG image | Layout resolves ogImage to either a provided asset path or the default OG PNG endpoint | c3-1 |
| Theme init | Inline script in head reads localStorage and sets data-theme before body renders to prevent FOUC | c3-1 |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-tailwind-design-system | ref | utility class usage and theming tokens in layout markup | Primary | Layout must use CSS variables from theme.css for colors |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| Layout.astro slot | IN | All page content rendered inside the layout body wrapper | All src/pages/*.astro | src/layouts/Layout.astro |
| PostLayout.astro props | IN | post metadata (title, pubDatetime, tags, etc.) required for structured post rendering | src/pages/posts/[...slug]/index.astro | src/layouts/PostLayout.astro |
| document head meta | OUT | Canonical URL, OG tags, and JSON-LD structured data emitted per page | Browser and crawlers | src/layouts/Layout.astro |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Breaking head meta for SEO | Removing or renaming canonical or OG meta tags | No automated check; manual audit required | src/layouts/Layout.astro review + lighthouse SEO audit |
| FOUC on theme switch | Removing inline theme script from document head | Visual flash on page load when switching themes | src/layouts/Layout.astro review + manual browser test |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Per-page document head | Goal section: SEO meta and OG tags emitted per page | Page-specific title and description | src/layouts/Layout.astro |
