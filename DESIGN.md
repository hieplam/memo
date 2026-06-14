# Design

The visual system for `memo` — a calm, unhurried, eye-comfortable reading
environment. Two first-class themes: **Sage / Fog** (light) and **Sage / Dusk**
(dark). Built on Tailwind v4 design tokens (`src/styles/theme.css`), a
color-wheel-derived scale + motion layer (`src/styles/tokens.css`), and the
Astro Fonts API.

## Design Direction

A quiet study with the blinds half-drawn — soft daylight on warm paper, read
without hurry. Low-contrast, warm-neutral surfaces, a single muted sage-teal
accent. Never harsh, never neon, never "developer-terminal." Color is used
sparingly; the prose leads and the chrome recedes.

Color strategy: **Restrained, warmed, low-contrast.** Warm fog-gray neutrals
carry the surfaces; one sage-teal accent does the emphatic work (links, focus,
key CTAs). Everything else whispers — even the semantic states are deliberately
muted.

## Color

Semantic tokens are authored as hex in `src/styles/theme.css`; the underlying
tonal ramps and harmonized state colors live in `src/styles/tokens.css`.
Contrast is verified against WCAG 2.1 AA (body ≥ 4.5:1, large/UI ≥ 3:1).

### Sage / Fog (light) — `:root`, `[data-theme="light"]`

| Token                 | Hex       | Role                                      |
| --------------------- | --------- | ----------------------------------------- |
| `--background`        | `#f3f2ec` | Fog paper (warm, not stark white)         |
| `--foreground`        | `#2c2e2a` | Soft charcoal ink (body + headings)       |
| `--accent`            | `#4f7c6b` | Muted sage-teal: links, focus, CTAs       |
| `--accent-foreground` | `#f7f8f4` | Text on accent fills                      |
| `--muted`             | `#eeede5` | Soft tint: code bg, inline fills          |
| `--muted-foreground`  | `#85857a` | Taupe meta text, captions, dates          |
| `--border`            | `#e1e0d6` | Hairlines, dividers                       |
| `--surface`           | `#f9f8f3` | Raised cards / wayfinding panels          |

### Sage / Dusk (dark) — `[data-theme="dark"]`

| Token                 | Hex       | Role                                      |
| --------------------- | --------- | ----------------------------------------- |
| `--background`        | `#1b1e1b` | Dusk green-charcoal (warm, not navy)      |
| `--foreground`        | `#e5e6dd` | Warm off-white text                       |
| `--accent`            | `#8fb6a3` | Soft eucalyptus: links, focus, CTAs       |
| `--accent-foreground` | `#1b1e1b` | Dark text on accent fills                 |
| `--muted`             | `#2b2f29` | Soft tint: code bg, inline fills          |
| `--muted-foreground`  | `#8f9085` | Latte-gray meta text                      |
| `--border`            | `#2d3029` | Hairlines, dividers                       |
| `--surface`           | `#22251f` | Raised cards / wayfinding panels          |

### Tonal ramps (`tokens.css`)

The semantic tokens above are drawn from two color-wheel-derived ramps:

- **Sage** (primary, hue 162°) `--sage-50…900`:
  `#eff8f3 #dff0e7 #c5dfd1 #a5c7b5 #79a28d #5a846f #456c58 #345444 #263c31 #1c2c24`
- **Fog** (warm neutral, hue 95°) `--fog-50…900`:
  `#f8f7f3 #f1f0eb #e1e0db #cccac5 #a09e98 #7d7c76 #5c5b56 #41403b #2f2e2a #22221e`

### Harmonized semantic colors (muted on purpose — a callout should *whisper*)

| Token       | Light                     | Dark                      |
| ----------- | ------------------------- | ------------------------- |
| `--success` | `#4e8164` / `#d8eee0`     | `#7fb295` / `#23362b`     |
| `--info`    | `#5a8297` / `#d6ecf8`     | `#86b0c6` / `#22323a`     |
| `--warning` | `#bd9761` / `#f8e5c7`     | `#d8b27e` / `#3a3122`     |
| `--danger`  | `#aa6259` / `#fedbd5`     | `#d29086` / `#3a2622`     |

(Each pair is `--<state>` / `--<state>-soft`. Derived from the wheel: analogous
green, split-complement blue, triadic amber, complementary clay.)

### Code blocks (Shiki)

Warm, soft syntax pair so code reads as part of the paper, not a glowing
terminal: light = `gruvbox-light-soft`, dark = `gruvbox-dark-soft`. Code
background follows `--muted`; selection/highlight tints stay warm. (Set in
`astro.config.ts → markdown.shikiConfig.themes`.)

## Typography

A single calm, all-sans family carries both reading and headings. No serif. The
mono earns its place only where it adds texture (code, small metadata labels).

- **Reading family (body + headings): `Hanken Grotesk`** — a warm, low-contrast
  grotesk that reads gently at length. Weights 400 / 500 / 600 / 700, italic
  available. Hierarchy comes from weight + size contrast within the one family;
  headings are **not** italic.
  - Loaded via the Astro Fonts API (Google provider) as `--font-hanken`,
    preloaded in `Layout.astro`, mapped to `--font-reading` in `theme.css`.
- **Mono family: `Google Sans Code`** (kept from the original identity) — code
  blocks, inline code, and small UI metadata (datetime, tags, labels). Also the
  family used by the Satori OG-image generators.
- **Scale:** modular, ≥ 1.25 ratio between steps; fluid `clamp()` on headings.
  Body ~17px, line-height ~1.65.
- **Reading measure:** body capped ~65–75ch (`max-w-app` ≈ `max-w-3xl`).
  `text-wrap: balance` on h1–h3; `text-wrap: pretty` on prose.

## Components

Existing AstroPaper components are preserved and re-skinned via tokens, not
rewritten: `Header`, `Footer`, `Card`, `Tag`, `Datetime`, `Pagination`,
`LangFilter`, `Breadcrumb`, `Socials`, `LinkButton`, `RelatedPosts`, search
(Pagefind). Because every component reads the semantic tokens, re-theming is a
values-only swap — no component changes.

Component conventions:

- Borders: 1px hairlines at `--border`. **Never** pair a 1px border with a wide
  (≥16px) drop shadow on the same element. Prefer borders + surface tint over
  shadow.
- Radius: cards/panels 8–14px; tags/buttons may be pill. No 24px+ on cards.
- Accent side-stripes are banned; use full borders or surface tints.

## Layout

- `app-layout` container (`max-w-3xl`, centered, `px-4`) is the reading column.
- Flex for 1D, Grid for 2D. Related-posts grid:
  `repeat(auto-fit, minmax(260px, 1fr))`.
- Fluid spacing with `clamp()`; vary rhythm (generous section separation, tight
  groupings within a card).

## Motion

A calm, token-driven motion system lives in `tokens.css` and is wired into the
live components in `global.css`. Slow + soft by default, in keeping with the
unhurried voice. No bounce/elastic.

- **Durations:** `--dur-1` 120ms (micro) · `--dur-2` 200ms (hover/links) ·
  `--dur-3` 320ms (cards/panels) · `--dur-4` 500ms (theme cross-fade) ·
  `--dur-5` 700ms (entrance/reveal).
- **Easings:** `--ease-standard` (general UI) · `--ease-out` (enters) ·
  `--ease-gentle` (soft settle) · `--ease-in` (exits).
- **Ready-made transitions:** `--t-colors`, `--t-transform`, `--t-theme`.
- **Keyframes:** `fade-up`, `fade-in`, `rise`.
- **Where it's used:** post-stream cards enter with a staggered `fade-up`
  (`.post-stream`), post links carry a token-driven color transition, and the
  reading-progress bar smooths its width.
- **Reduced motion:** all animation/transition is globally disabled under
  `prefers-reduced-motion: reduce` (media query in `tokens.css`).

## Focus & States

- Keep the project's accessible focus model (dashed accent outline, offset),
  retinted to the sage `--accent`; visible in both themes.
- Active nav: wavy accent underline (existing), retinted.

## Token files at a glance

- `src/styles/theme.css` — semantic tokens (the contract every component reads)
  + the Tailwind `@theme inline` bridge and font mapping.
- `src/styles/tokens.css` — Sage/Fog tonal ramps, harmonized state colors, and
  the full motion scale (durations, easings, transitions, keyframes).
- `src/styles/global.css` — base layer, utilities, and the motion wiring that
  connects the primitives to components.
- `src/styles/typography.css` — long-form prose (`.app-prose`) and code blocks.
