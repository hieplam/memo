# Design

The visual system for `memo` — a coffee-warm, unhurried reading environment.
Two first-class themes: **Latte** (light) and **Mocha** (dark). Built on
Tailwind v4 design tokens (`src/styles/theme.css`) and the Astro Fonts API.

## Design Direction

A worn paperback on a café table, read slowly on a Sunday. Warm paper, espresso
ink, a single cinnamon-roast accent. Calm, low-glare, never neon, never
"developer-terminal." Color is used sparingly and warmly; the prose leads and
the chrome recedes.

Color strategy: **Restrained, warmed.** Tinted warm neutrals carry the surface;
one coffee accent does the emphatic work (links, focus, key CTAs). Warmth lives
in the hues and the typography, not in loud fills.

## Color

All values authored in OKLCH; hex shown for reference. Contrast verified against
WCAG 2.1 AA (body ≥ 4.5:1, large/UI ≥ 3:1).

### Latte (light) — `:root`, `[data-theme="light"]`

| Token                 | OKLCH                  | Hex       | Role                                    |
| --------------------- | ---------------------- | --------- | --------------------------------------- |
| `--background`        | `0.965 0.013 80`       | `#f8f3ea` | Milk-foam paper (warm, not stark white) |
| `--foreground`        | `0.285 0.018 55`       | `#312822` | Espresso ink (body) — 13.0:1            |
| `--muted`             | `0.91 0.018 75`        | `#ece3d7` | Soft tint: code bg, inline fills        |
| `--muted-foreground`  | `0.505 0.025 55`       | `#706157` | Taupe meta text — 5.4:1                 |
| `--accent`            | `0.520 0.110 50`       | `#9a5328` | Cinnamon-roast: links, focus, CTAs — 5.2:1 |
| `--accent-foreground` | `0.98 0.01 85`         | `#fdf8ef` | Text on accent fills                    |
| `--border`            | `0.885 0.015 75`       | `#dfd8ce` | Hairlines, dividers                     |
| `--surface`           | `0.935 0.016 78`       | `#f0e8de` | Raised cards / wayfinding panels        |

### Mocha (dark) — `[data-theme="dark"]`

| Token                 | OKLCH                  | Hex       | Role                                    |
| --------------------- | ---------------------- | --------- | --------------------------------------- |
| `--background`        | `0.255 0.018 55`       | `#2a211b` | Roasted-brown (warm, not navy/black)    |
| `--foreground`        | `0.920 0.013 82`       | `#e9e4db` | Warm milk text — 12.5:1                 |
| `--muted`             | `0.33 0.020 55`        | `#3a2f27` | Soft tint: code bg, inline fills        |
| `--muted-foreground`  | `0.745 0.022 72`       | `#b5aa9e` | Latte-gray meta text — 6.9:1            |
| `--accent`            | `0.800 0.095 72`       | `#e4b478` | Caramel/honey: links, focus, CTAs — 8.3:1 |
| `--accent-foreground` | `0.255 0.018 55`       | `#2a211b` | Dark text on accent fills               |
| `--border`            | `0.380 0.020 58`       | `#4b4038` | Hairlines, dividers                     |
| `--surface`           | `0.305 0.020 55`       | `#372d26` | Raised cards / wayfinding panels        |

Note: `--surface` is a new token added for the wayfinding panels; the existing
`--color-*` Tailwind bridge in `theme.css` gains a matching `--color-surface`.

### Code blocks (Shiki)

Replace any cool/neon syntax theme with a **warm pair** so code reads as part of
the paper, not a glowing terminal: light = a warm cream theme; dark = a warm
brown/amber theme. Code background follows `--muted`; selection/highlight tints
stay warm.

## Typography

The current site sets monospace everywhere. For comfortable long-form reading we
introduce a warm reading serif as the base, and keep monospace only where it
earns its place (code, and small metadata labels), giving gentle texture without
the terminal costume the brand bans.

- **Reading family (body + headings): `Spectral`** — a calm, warm screen-reading
  serif (off the reflex-reject list). Weights 400 / 500 / 600 / 700, with
  italic. Hierarchy comes from weight + size contrast within one family.
  - Loaded via the Astro Fonts API (Google provider) alongside the existing mono;
    consumed by `Layout.astro` and the Satori OG-image generators.
- **Mono family: `Google Sans Code`** (kept from the existing identity) — code
  blocks, inline code, and small UI metadata (datetime, tags) as a subtle label
  texture.
- **Scale:** modular, ≥ 1.25 ratio between steps; fluid `clamp()` on headings.
  Hero/display `clamp()` max ≤ 6rem; display letter-spacing ≥ -0.04em.
- **Reading measure:** body capped ~65–75ch (existing `max-w-app` ≈ `max-w-3xl`
  is in range). `text-wrap: balance` on h1–h3; `text-wrap: pretty` on prose.

## Components

Existing AstroPaper components are preserved and re-skinned, not rewritten:
`Header`, `Footer`, `Card`, `Tag`, `Datetime`, `Pagination`, `LangFilter`,
`Breadcrumb`, `Socials`, `LinkButton`, search (Pagefind).

New for the wayfinding work:

- **RelatedPosts** — at the end of each article, 2–3 posts in the same
  language, matched by shared tags, on a `--surface` panel. The path to a
  second read.
- **Post-end "keep reading" footer** — calm prompt: continue reading + subscribe
  (RSS), no hard sell.
- **Richer empty/landing wayfinding** — tags and archives made discoverable from
  the post reading flow.

Component conventions:

- Borders: 1px hairlines at `--border`. **Never** pair a 1px border with a wide
  (≥16px) drop shadow on the same element. Prefer borders + surface tint over
  shadow.
- Radius: cards/panels 8–12px; tags/buttons may be pill. No 24px+ on cards.
- Accent side-stripes are banned; use full borders or surface tints.

## Layout

- `app-layout` container (`max-w-3xl`, centered, `px-4`) stays the reading column.
- Flex for 1D, Grid for 2D. Related-posts grid:
  `repeat(auto-fit, minmax(260px, 1fr))`.
- Fluid spacing with `clamp()`; vary rhythm (generous section separation, tight
  groupings within a card).

## Motion

- Quiet by default, in keeping with the unhurried voice. Subtle, purposeful
  transitions only (hover/focus affordances, a gentle reveal on the
  related-posts panel).
- Ease-out curves; no bounce/elastic. Respect `prefers-reduced-motion` with a
  crossfade/instant fallback for anything added.

## Focus & States

- Keep the project's accessible focus model (dashed accent outline, offset).
  Re-tint to the coffee `--accent`; preserve visibility in both themes.
- Active nav: wavy accent underline (existing), retinted.
