---
id: c3-1
c3-seal: fbf8faaae25ecb7e41052a3729e091c87c9b42ddf635e120f8ee1008b62a79d7
title: Hiep Lam Blog
type: container
boundary: service
parent: c3-0
goal: Serve as the single Astro 6 static site that builds all blog content, routes, and assets into a fully-static output deployed to Cloudflare Pages. Provides a minimal, SEO-friendly, accessible personal blog named "Hiep Lam" with type-safe content collections, Pagefind-powered search, and dynamic per-post OG images.
---

## Goal

Serve as the single Astro 6 static site that builds all blog content, routes, and assets into a fully-static output deployed to Cloudflare Pages. Provides a minimal, SEO-friendly, accessible personal blog named "Hiep Lam" with type-safe content collections, Pagefind-powered search, and dynamic per-post OG images.

## Components

| ID | Name | Category | Status | Goal Contribution |
| --- | --- | --- | --- | --- |
| c3-101 | Content Collections | Foundation | active | Defines Zod-validated post/page schemas and loads markdown/MDX via Astro content loaders |
| c3-102 | Layouts | Foundation | active | Provides base HTML shell and post-level wrappers that all pages compose from |
| c3-103 | UI Components | Foundation | active | Shared presentational Astro components (Header, Footer, Card, Pagination, etc.) |
| c3-104 | Styles | Foundation | active | Global CSS, typography, and theme tokens consumed by layouts and components |
| c3-105 | Utils | Foundation | active | Pure TypeScript helper functions for post filtering, sorting, tag extraction, slug generation, and font resolution |
| c3-106 | CI & Release Automation | Foundation | active | GitHub Actions CI (lint/format/build) plus release-please for conventional-commit-driven versioning, CHANGELOG, tags, and GitHub Releases |
| c3-110 | Pages & Routing | Feature | active | File-based routes for index, post list/detail, tags, archives, search, about, RSS, robots, and OG endpoints |
| c3-111 | Internationalization | Feature | active | Locale-keyed UI strings loaded at build time; currently English-only with fallback pattern |
| c3-112 | OG Image Generation | Feature | active | Generates static 1200x630 PNG OG images using Satori + Sharp at build time for the site default and per-post |

## Components

| ID | Name | Category | Status | Goal Contribution |
| --- | --- | --- | --- | --- |
| c3-101 | Content Collections | Foundation | active | Defines Zod-validated post/page schemas and loads markdown/MDX via Astro content loaders |
| c3-102 | Layouts | Foundation | active | Provides base HTML shell and post-level wrappers that all pages compose from |
| c3-103 | UI Components | Foundation | active | Shared presentational Astro components (Header, Footer, Card, Pagination, etc.) |
| c3-104 | Styles | Foundation | active | Global CSS, typography, and theme tokens consumed by layouts and components |
| c3-105 | Utils | Foundation | active | Pure TypeScript helper functions for post filtering, sorting, tag extraction, slug generation, and font resolution |
| c3-110 | Pages & Routing | Feature | active | File-based routes for index, post list/detail, tags, archives, search, about, RSS, robots, and OG endpoints |
| c3-111 | Internationalization | Feature | active | Locale-keyed UI strings loaded at build time; currently English-only with fallback pattern |
| c3-112 | OG Image Generation | Feature | active | Generates static 1200x630 PNG OG images using Satori + Sharp at build time for the site default and per-post |

## Responsibilities

- Build all pages to static HTML via `astro build` using bun as the package manager and task runner.
- Validate content frontmatter at build time via Zod schemas defined in `src/content.config.ts`.
- Serve a Pagefind search index generated as a post-build step.
- Deploy deterministically to GitHub Pages from the `dist/` output on every push to `main`, served from the `/memo/` project subpath (Astro `base`).
- Maintain SEO correctness: canonical URLs, sitemap, RSS feed, robots.txt, and OG images.
- Enforce accessibility and responsive layout via TailwindCSS 4 utility classes and semantic HTML.
- Run CI (lint, format check, build) on every push and pull request, and automate releases via release-please on merges to `main`.

## Complexity Assessment

Moderate. Single deployment boundary with no server-side runtime; all complexity lives in the build pipeline (Astro + Zod + Pagefind + Satori/Sharp) and in the content authoring conventions (frontmatter schema, draft/scheduled post logic, tag taxonomy).
