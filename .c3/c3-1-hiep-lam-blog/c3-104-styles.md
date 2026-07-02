---
id: c3-104
c3-seal: 8bfba72ea9830428df91cd1e456c08d1d70cbdbc921b16105b603977f0e90c0b
title: styles
type: component
category: foundation
parent: c3-1
goal: Define the global CSS reset, TailwindCSS 4 theme tokens, typography styles, and dark/light color schemes that all layouts and components depend on.
uses:
    - ref-tailwind-design-system
---

## Goal

Define the global CSS reset, TailwindCSS 4 theme tokens, typography styles, and dark/light color schemes that all layouts and components depend on.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | Hiep Lam Blog (c3-1) |
| Category | Foundation (04) |
| Owned files | src/styles/global.css, src/styles/theme.css, src/styles/typography.css |
| Depended on by | layouts (imports global.css), all components via Tailwind utility classes |

## Purpose

Owns the three CSS files that form the design system: global.css (base reset, global rules, and layout-only presentation for rendered Mermaid diagrams under the `.mermaid` class — centring, responsive SVG sizing, and horizontal overflow; diagram colours come from the Mermaid theme chosen by src/scripts/mermaid.ts, not from here), theme.css (CSS custom properties for light and dark color palettes referenced by components), typography.css (prose typography for rendered markdown). Does NOT own component-level utility class usage; that is governed by ref-tailwind-design-system.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Preconditions | TailwindCSS 4 Vite plugin processes CSS at build time before serving | c3-1 |
| Inputs | CSS custom properties defined in theme.css consumed by all components via var() references | c3-1 |
| State | Dark/light theme toggled by data-theme attribute on html element; theme.css defines both palettes | c3-1 |
| Shared deps | @tailwindcss/typography plugin for prose class applied to markdown content | c3-1 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Primary path | Layout.astro imports global.css, Tailwind processes all CSS files, output injected into built HTML | c3-1 |
| Theme switch | User toggles theme, JS sets data-theme on html, CSS custom properties cascade to new palette | c3-1 |
| Typography | Markdown content wrapped in prose class applies @tailwindcss/typography rules from typography.css | c3-1 |
| Build output | All CSS tree-shaken and minified by Tailwind/Vite pipeline into dist/ | c3-1 |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| ref-tailwind-design-system | ref | color token naming and theme CSS variable contracts | Primary | New color tokens must be added to theme.css as CSS custom properties |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| CSS custom properties | OUT | Color and spacing tokens accessible via var(--color-*) to all components | All src/components and src/layouts | src/styles/theme.css |
| prose class | OUT | Typography styles for rendered markdown applied via @tailwindcss/typography | PostLayout.astro content area | src/styles/typography.css |
| global.css | OUT | Base reset and global body/html rules applied to all pages | All pages | src/styles/global.css |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Breaking theme CSS variables | Renaming or removing a CSS custom property from theme.css | Components referencing removed variable show browser default color | src/styles/theme.css change + full visual review in both light and dark modes |
| Typography regression | Changing typography.css prose rules | Markdown content renders incorrectly in posts | src/styles/typography.css change + spot-check rendered post page |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| Component color usage | Goal section: CSS custom properties for light and dark color palettes | Component-specific opacity or shadow variations | src/styles/theme.css |
