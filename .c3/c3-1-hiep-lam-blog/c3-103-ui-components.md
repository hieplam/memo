---
id: c3-103
c3-seal: 9a729455460390dd91b83caf45940277212c19308ec939a104f4e228ad3d0f15
title: ui-components
type: component
category: foundation
parent: c3-1
goal: Provide shared, reusable presentational Astro components for headers, footers, cards, pagination, tags, breadcrumbs, social links, and other UI primitives used across all pages.
uses:
    - ref-tailwind-design-system
---

## Goal

Provide shared, reusable presentational Astro components for headers, footers, cards, pagination, tags, breadcrumbs, social links, and other UI primitives used across all pages.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | Hiep Lam Blog (c3-1) |
| Category | Foundation (03) |
| Owned files | src/components/*.astro |
| Depended on by | layouts, pages-routing import these components |

## Purpose

Owns all Astro components in src/components/: Header.astro, Footer.astro, Card.astro, Pagination.astro, Tag.astro, Breadcrumb.astro, Socials.astro, Datetime.astro, Main.astro, LinkButton.astro, ResponsiveTable.astro, LangFilter.astro (post-language filter bar). Card.astro additionally renders a per-post language badge. Does NOT own page-level route components under src/pages/posts/[...slug]/_components/ which are co-located feature-level components.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Preconditions | TailwindCSS 4 compiled at build time; SVG icons available in src/assets/icons/ | c3-1 |
| Inputs | Props passed by parent layouts or pages (post entries, pagination data, tag names, social links) | c3-1 |
| State | Dark/light theme driven by data-theme attribute on document root, not component-local state | c3-1 |
| Shared deps | src/config.ts for site title and social links; src/assets/icons/ for inline SVG icons | c3-1 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Primary path | Pages import components and pass typed props; components render accessible semantic HTML with Tailwind classes | c3-1 |
| Theme adaptation | Components use CSS variables from theme.css; no runtime theme logic inside components | c3-1 |
| Pagination | Pagination.astro receives current page number and total pages and emits prev/next links | c3-1 |
| Socials | Socials.astro reads social config from astro-paper.config.ts and renders icon links | c3-1 |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-tailwind-design-system | ref | utility class patterns and color token usage in all component markup | Primary | Components must use design tokens via CSS variables, not hardcoded colors |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| Component props | IN | Typed Astro props interface per component | Callers in layouts and pages | src/components/*.astro |
| Rendered HTML | OUT | Semantic accessible HTML conforming to WCAG AA contrast ratios | Browser rendering | src/components/*.astro |
| Card.astro | OUT | Renders a post card with title, datetime, description, and tag links | Used in index and post list pages | src/components/Card.astro |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Breaking responsive layout | Changing Tailwind class structure in Header or Main | Visual regression on mobile viewport | src/components/ change + manual mobile browser test |
| Accessibility regression | Removing aria labels or semantic HTML from interactive components | No automated check in build | src/components/ change + axe accessibility scan |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Rendered page UI | Goal section: shared presentational components used across all pages | Page-specific content and props | src/components/*.astro |
