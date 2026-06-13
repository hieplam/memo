---
id: adr-00000000-c3-adoption
c3-seal: a242618ca5c8c5c49f7a1eae79b8b54aaf27ba3a15e861a2f5d1650e54bef09b
title: C3 Architecture Documentation Adoption
type: adr
goal: Adopt C3 architecture documentation for the "Hiep Lam" Astro 6 static blog. This decision establishes the `.c3/` topology — one container, seven components, four refs, and two rules — so that future sessions can use `/c3` to understand, change, and audit the codebase instead of re-reading raw files each time.
status: implemented
date: "2026-06-08"
affects:
    - c3-0
---

## Goal

Adopt C3 architecture documentation for the "Hiep Lam" Astro 6 static blog. This decision establishes the `.c3/` topology — one container, seven components, four refs, and two rules — so that future sessions can use `/c3` to understand, change, and audit the codebase instead of re-reading raw files each time.

## Context

The blog is a freshly renamed personal site (previously AstroPaper template) with no architecture documentation. The toolchain has been migrated to bun + Astro 6 + TailwindCSS 4 + Pagefind and deployed to Cloudflare Pages. Without C3 docs, every change session must re-discover ownership, constraints, and cross-cutting patterns from scratch. C3 onboarding resolves this by creating a permanent, queryable topology stored in `.c3/`.

## Decision

Scaffold `.c3/` using the C3 CLI, model the site as a single deployment container with components that reflect the actual `src/` areas (content collections, layouts, UI components, pages/routing, styles, utils, i18n, OG-image generation), add cross-cutting refs for the content-collection schema, Tailwind design system, and i18n strategy, and add rules derived from the eslint and prettier configs. Inject `CLAUDE.md` so future sessions activate C3 automatically.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| Hiep Lam Blog | container | New container doc created to represent the Astro static site deployment boundary | Review container README completeness |
| content-collections | component | New component doc created for src/content + content.config.ts | Verify codemap and ref wiring |
| layouts | component | New component doc created for src/layouts/ | Verify codemap |
| ui-components | component | New component doc created for src/components/ | Verify codemap |
| pages-routing | component | New component doc created for src/pages/ | Verify codemap |
| styles | component | New component doc created for src/styles/ | Verify codemap |
| utils | component | New component doc created for src/utils/ | Verify codemap |
| i18n | component | New component doc created for src/i18n/ | Verify codemap and ref wiring |
| og-image | component | New component doc created for OG image generation (src/pages/og.png.ts + src/pages/posts/[...slug]/index.png.ts) | Verify codemap |
| ref-content-schema | ref | New ref created to document the Zod-based content collection schema contract | Verify choice + why filled |
| ref-tailwind-design-system | ref | New ref created to document TailwindCSS 4 design system usage | Verify choice + why filled |
| ref-i18n-strategy | ref | New ref created to document i18n approach | Verify choice + why filled |
| ref-og-image-generation | ref | New ref created to document Satori/Sharp OG pipeline | Verify choice + why filled |
| rule-no-console | rule | New rule created from eslint no-console: error | Verify rule + golden example |
| rule-prettier-format | rule | New rule created from prettier config conventions | Verify rule + golden example |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| N.A - initial onboarding, no refs exist yet | No prior refs to comply with | N.A - first adoption |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| N.A - initial onboarding, no rules exist yet | No prior rules to comply with | N.A - first adoption |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| c3 init | Scaffold .c3/ with c3 init | .c3/ directory created |
| ADR-000 body | Fill ADR-000 via c3 write with this body | c3 check passes |
| Container doc | c3 add container hiep-lam-blog | c3 list shows container |
| Component docs | c3 add component for each of 7 areas | c3 list shows all components |
| Ref docs | c3 add ref for 4 cross-cutting refs | c3 list shows refs |
| Rule docs | c3 add rule for 2 coding standards | c3 list shows rules |
| Codemap patterns | c3 set codemap for each component/ref | c3 lookup 'src/**' resolves |
| Wire refs | c3 wire components to their refs | c3 check passes |
| CLAUDE.md | Write /Users/home/repos/todd.lamb/CLAUDE.md with C3 architecture section | File exists |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - this ADR documents application architecture adoption, not changes to the C3 underlay itself | No C3 CLI commands, validators, schemas, or tests are modified | c3 check validates the resulting docs |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| c3 check | Validates codemap patterns, required sections, wiring, orphan refs | Passes with 0 errors after onboarding |
| c3 lookup 'src/**' | Maps any src/ file to its owning component | Returns component + refs for covered files |
| CLAUDE.md | Instructs future sessions to use /c3 before reading raw files | File present at repo root |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| README-only architecture docs | No structured lookup, no codemap, no drift detection; every session re-reads raw files |
| Inline comments in source files | Scattered, not queryable as topology, cannot enforce cross-cutting refs across components |
| Multiple containers (e.g., build pipeline as separate container) | Single Cloudflare Pages deployment with bun build; no separate runtime boundary justifies a second container |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Codemap patterns too broad cause false lookups | Use specific glob patterns per component, not catch-all | c3 lookup spot-check on representative files |
| ADR marked implemented before check passes | Require c3 check 0 errors before transitioning status | c3 check output shows PASS |
| CLAUDE.md not created | Explicit step in work breakdown | File exists at repo root |

## Verification

| Check | Result |
| --- | --- |
| c3 check | 0 errors |
| c3 list | Shows 1 container, 7+ components, 4 refs, 2 rules |
| c3 lookup 'src/content/**' | Resolves to content-collections component |
| c3 lookup 'src/components/**' | Resolves to ui-components component |
| CLAUDE.md exists at repo root | File present with # Architecture section |
