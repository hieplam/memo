# Architecture
This project uses C3 docs in `.c3/`.
For architecture questions, changes, audits, file context -> `/c3`.
Operations: query, audit, change, ref, rule, sweep.
File lookup: `c3 lookup <file-or-glob>` maps files/directories to components + refs.

# Coding Conventions
Coding standards for this repo live in [`docs/rules.md`](docs/rules.md) — TypeScript
strictness, `@/*` path-alias imports, ordered imports, no `console.*` in `src/`, and
Prettier formatting. Follow them when adding or changing code.

# Before committing
Run the same checks CI runs ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):
- `bun run lint` — ESLint must be clean.
- `bun run format:check` — Prettier must be clean (use `bun run format` to fix).
- `bun run build` — `astro check` + build must succeed.

# Wiki / Context
This project has an LLM-maintained wiki under `wiki/`. You MUST NOT hand-edit wiki
docs (`wiki/sources`, `wiki/notes`, `index.md`, `log.md`) — they are managed by the
Ymir wiki CLI and a PreToolUse hook blocks direct edits. See
[`wiki/SCHEMA.md`](wiki/SCHEMA.md) for the rules and command reference. (Architecture
knowledge stays in C3 above; the wiki is for research notes and ingested sources.)
