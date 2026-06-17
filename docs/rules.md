# Project Rules — memo

Conventions for the `memo` Astro blog. Generated from `.ymir/harness-profile.yaml`.
These are the standards Claude Code and contributors obey on this repo. Architecture
lives in C3 (`.c3/`, via `/c3`); this file is about coding conventions.

## NEVER

- **No `console.*` in `src/`** — no `console.log`/`warn`/`error` in `.ts`/`.tsx`/`.astro`
  source. ESLint `no-console: error` fails CI. Throw a typed `Error` or return a typed
  value instead. (Config files outside `src/` are exempt.)
- **No implicit `any`** — never let a value resolve to `any`. `tsconfig` extends
  `astro/tsconfigs/strict`; annotate or narrow types so nothing falls back to `any`.
- **No unused variables or imports** — remove dead bindings and imports; don't leave
  them "for later."

## TypeScript strictness

- `tsconfig.json` extends `astro/tsconfigs/strict` — keep it strict; do not loosen
  `strict`, `noImplicitAny`, or null-safety flags.
- Exported functions declare **explicit return types**. Prefer typed returns over
  inference at module boundaries so the contract is visible at the call site.
- Use `astro:content` `CollectionEntry<...>` types for content; don't hand-roll
  shapes that duplicate the Zod schema in `src/content.config.ts`.

## Imports & file conventions

- **Path aliases over deep relatives.** Import from `@/*` (maps to `./src/*`) and
  `@/astro-paper.config`; avoid `../../..` chains. Aliases are defined in
  `tsconfig.json`.
- **Ordered, grouped imports** — group in this order: third-party packages, then
  internal `@/` modules, then relative; keep each group ordered.
- Keep file naming consistent with the surrounding directory (the existing
  `src/utils`, `src/components`, `src/layouts` conventions).

## Formatting

- All source is **Prettier-clean** per `.prettierrc`: 2-space indent, double quotes,
  semicolons, 80-char print width, ES5 trailing commas, LF line endings,
  `arrowParens: "avoid"`. `prettier-plugin-astro` formats `.astro`;
  `prettier-plugin-tailwindcss` sorts Tailwind classes.
- Run `bun run format` to fix and `bun run format:check` to verify before committing.
  Generated output (`dist/`, `public/pagefind/`) is excluded.

## Verify before commit

- `bun run lint` — ESLint clean.
- `bun run format:check` — Prettier clean.
- `bun run build` — `astro check` + build succeed.
