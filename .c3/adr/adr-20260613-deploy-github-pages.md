---
id: adr-20260613-deploy-github-pages
c3-seal: 82175fd0de10a0a9e3bf24a6631fc700ff27ddb18a3eeed084be1d4fa844b23d
title: deploy-github-pages
type: adr
goal: 'Add a GitHub Pages deployment pipeline for the blog: a new GitHub Actions workflow that builds the Astro site with bun on every push to `main` and publishes the `dist/` artifact to GitHub Pages, plus the Astro `site`/`base` configuration required to serve correctly from the project subpath `https://hieplam.github.io/memo/`. This authorizes serving the production blog from GitHub Pages instead of the leftover theme default (Cloudflare Pages `astro-paper.pages.dev`).'
status: implemented
date: "2026-06-13"
---

## Goal

Add a GitHub Pages deployment pipeline for the blog: a new GitHub Actions workflow that builds the Astro site with bun on every push to `main` and publishes the `dist/` artifact to GitHub Pages, plus the Astro `site`/`base` configuration required to serve correctly from the project subpath `https://hieplam.github.io/memo/`. This authorizes serving the production blog from GitHub Pages instead of the leftover theme default (Cloudflare Pages `astro-paper.pages.dev`).

## Context

The repository `github.com/hieplam/memo` currently has CI (`ci.yml`) that lints, format-checks, and builds on pull requests, and `release-please` for versioning — but **no deployment**. The site is never published anywhere. `astro-paper.config.ts` still carries the upstream theme's `site.url` (`https://astro-paper.pages.dev/`), which is wrong for this fork. Because the repo is a project repo (not `hieplam.github.io`), GitHub Pages serves it under the `/memo/` subpath, so without an Astro `base` every CSS file, image, and internal link resolves to the domain root and 404s. The change touches the delivery layer (c3-106 ci-release, which owns `.github/workflows`) and the Astro build/site configuration (`astro.config.ts`, `astro-paper.config.ts`, owned by the container c3-1).

## Decision

Use **GitHub's first-party Pages Actions** (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`) in a dedicated `.github/workflows/deploy.yml`, triggered on `push` to `main` plus `workflow_dispatch`. Build with `oven-sh/setup-bun` + `bun run build` to match existing CI, then upload `dist/`. Set Astro `site: "https://hieplam.github.io"` and `base: "/memo"` so emitted asset/link URLs carry the subpath. Drive the values from `astro-paper.config.ts` so site identity stays single-sourced. This is preferred over a Pages-deploy action that pushes to a `gh-pages` branch because the artifact/deploy model needs no extra branch, no PAT, and uses the repo's built-in `GITHUB_TOKEN` with least-privilege `pages: write`/`id-token: write` scopes.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-106 | component | Owns .github/workflows/; gains a new deploy.yml delivery workflow that publishes the site | Update component Owned files + Contract to list the deploy workflow and its GitHub Pages OUT surface |
| c3-1 | container | Owns the Astro build config; astro.config.ts gains base, and site identity in astro-paper.config.ts changes from the theme default to the Pages URL | Confirm container build-config responsibility still holds; record Parent Delta |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| ref-og-image-generation | OG images embed absolute URLs derived from site; changing site to the Pages domain changes generated OG image URLs | review |
| N.A - ref-content-schema, ref-i18n-strategy, ref-tailwind-design-system are untouched by deployment/base-path config | N.A | N.A |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-prettier-format | The new deploy.yml is YAML under .github/ and must be prettier-clean per the rule | comply |
| N.A - rule-no-console does not apply: no application/runtime JS is added, only YAML and declarative config | N.A | N.A |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| Deploy workflow | Create .github/workflows/deploy.yml: trigger push→main + workflow_dispatch; build job (checkout, setup-bun, install, configure-pages, build, upload-pages-artifact) + deploy job (deploy-pages) with pages: write/id-token: write | .github/workflows/deploy.yml |
| Site identity | Update astro-paper.config.ts site.url from https://astro-paper.pages.dev/ to the origin https://hieplam.github.io/ (origin only; the subpath is carried by base, so OG/canonical URLs do not double /memo) | astro-paper.config.ts |
| Base path | Add base: "/memo" to astro.config.ts defineConfig so internal links/assets resolve under the project subpath | astro.config.ts |
| Build script | Leave package.json build script unchanged: the cp -r dist/pagefind public/ tail feeds local dev/preview search and public/pagefind is already gitignored, so it neither pollutes git nor affects the deployed dist/ | .gitignore line 26 |
| C3 docs | Update c3-106 Owned files/Contract; record c3-1 Parent Delta | c3 write/c3 set output |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - no C3 CLI/validator/schema change | N.A - this ADR changes application delivery config only, not the C3 tooling underlay | N.A - c3 check run after doc edits is the only C3 interaction |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| deploy.yml Actions run | A push to main that fails to build blocks deployment; success publishes to Pages and shows the live URL on the deploy job | .github/workflows/deploy.yml |
| bun run build | astro check + build must succeed locally and in CI with the new base; broken base config fails the build | package.json build script |
| ci.yml format:check | prettier --check . fails the PR if deploy.yml is not prettier-clean | .github/workflows/ci.yml |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| peaceiris/actions-gh-pages pushing to a gh-pages branch | Adds a tracked artifact branch and needs branch bookkeeping; GitHub's native artifact/deploy flow avoids the extra branch and uses built-in GITHUB_TOKEN |
| Rename repo to hieplam.github.io (root user site, no base) | User chose to keep the memo repo name; renaming would break the existing remote and require base:'/' rework |
| Custom domain + CNAME (base:'/') | User declined DNS setup for now; subpath needs no DNS |
| Deploy on manual trigger only | User chose auto-deploy on push to main; workflow_dispatch is kept additionally for manual reruns |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Assets/links 404 under /memo/ because a hardcoded absolute path bypasses base | Set base in astro.config so Astro rewrites internal URLs; rely on theme using import.meta.env.BASE_URL/Astro helpers | bun run build succeeds and built HTML in dist/ references /memo/ asset paths |
| Deploy job fails on first run because Pages source not set to "GitHub Actions" | Document the one-time repo Settings → Pages → Source = GitHub Actions step in the handoff | First deploy.yml run reaches the deploy job and reports a live URL |
| OG image absolute URLs point at the old pages.dev domain | Update site.url so OG generation uses the Pages domain | Built OG image URLs/meta tags reference hieplam.github.io/memo |

## Verification

| Check | Result |
| --- | --- |
| bun run build in the worktree | Exits 0; dist/ produced with /memo/-prefixed asset URLs |
| bun run format:check | Exits 0 (deploy.yml prettier-clean) |
| bun run lint | Exits 0 |
| c3 check after doc edits | 0 issues |
| GitHub Actions deploy.yml run on main | Build + deploy jobs green; deploy job outputs the live https://hieplam.github.io/memo/ URL |
