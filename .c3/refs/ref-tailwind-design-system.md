---
id: ref-tailwind-design-system
c3-seal: abf9ec80cf1d90bac6e29b4e735bf4030e3f97cd5768206453ca197fd1311a20
title: tailwind-design-system
type: ref
goal: Standardize how color tokens, spacing, and visual theme are applied across all components and layouts so that light/dark mode switching works consistently and the design system has a single source of truth.
---

## Goal

Standardize how color tokens, spacing, and visual theme are applied across all components and layouts so that light/dark mode switching works consistently and the design system has a single source of truth.

## Choice

TailwindCSS 4 with CSS custom properties as the token layer: color palettes defined as CSS variables in src/styles/theme.css and consumed by Tailwind utilities via var() references; @tailwindcss/typography for markdown prose styling; dark/light mode driven by data-theme attribute on the html element.

## Why

TailwindCSS 4's CSS-first config (no tailwind.config.js) lets design tokens live in theme.css as plain CSS custom properties, making them accessible both to Tailwind utility classes and to any plain CSS that needs them. This eliminates the dual maintenance burden of keeping a JS config file and a CSS file in sync. The data-theme attribute approach (rather than the prefers-color-scheme media query alone) lets the user preference override the OS default, which was required by the original AstroPaper theme contract. The alternative — CSS modules per component — was rejected because it would fragment the design system across dozens of files with no single place to change the color palette.

## How

Theme tokens are defined in src/styles/theme.css and used in component markup:

```css
/* src/styles/theme.css — REQUIRED pattern */
:root,
html[data-theme="light"] {
  --color-fill: 251, 254, 251;
  --color-text-base: 40, 39, 40;
  /* ... other tokens */
}
html[data-theme="dark"] {
  --color-fill: 33, 39, 55;
  --color-text-base: 234, 237, 243;
  /* ... other tokens */
}
```

Components reference tokens via Tailwind utility classes that use these variables. The theme toggle in src/scripts/theme.ts sets data-theme on the html element. REQUIRED: all color usage must go through CSS custom properties. OPTIONAL: component-level opacity modifiers (e.g. bg-skin-fill/80).
