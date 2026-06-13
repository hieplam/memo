---
id: adr-20260608-adopt-release-please
c3-seal: 6e62b32c4ecdd40456fd233347ff81dcda565f8547ea6455a63dcbed81906e98
title: adopt-release-please
type: adr
goal: 'Adopt [release-please](https://github.com/googleapis/release-please) to automate version bumps, `CHANGELOG.md` maintenance, git tags, and GitHub Releases for this blog, driven by the Conventional Commit history the repo already standardizes on (commitizen `cz.yaml`). Concretely: add a `release-please` GitHub Actions workflow plus manifest-mode config so that merging Conventional Commits to `main` produces a reviewable "release PR" whose merge cuts a versioned GitHub Release.'
status: implemented
date: "2026-06-08"
---

## Goal

Adopt [release-please](https://github.com/googleapis/release-please) to automate version bumps, `CHANGELOG.md` maintenance, git tags, and GitHub Releases for this blog, driven by the Conventional Commit history the repo already standardizes on (commitizen `cz.yaml`). Concretely: add a `release-please` GitHub Actions workflow plus manifest-mode config so that merging Conventional Commits to `main` produces a reviewable "release PR" whose merge cuts a versioned GitHub Release.

## Context

The repo already enforces Conventional Commits (commitizen config in `cz.yaml`) and ships CI in `.github/workflows/ci.yml` (lint, format check, bun build), but releases are entirely manual: `package.json` `version` (currently `6.1.0`, inherited from the AstroPaper template) and the 34 KB `CHANGELOG.md` would have to be hand-edited, and no git tags / GitHub Releases are cut. This is error-prone and inconsistent with the conventional-commit discipline already in place. Topologically, the delivery tooling is currently **uncharted** in C3: `c3 lookup` returns no owner for `.github/workflows/ci.yml`, `package.json`, or `CHANGELOG.md` — the onboarding scoped components to `src/**` only. So this change both adds release automation and charts the CI/release concern under container `c3-1` (Hiep Lam Blog).

## Decision

Use `googleapis/release-please-action@v4` in **manifest mode** with `release-type: node` (version source = `package.json`), triggered on `push` to `main`, authenticated with the default `secrets.GITHUB_TOKEN`. Three files are added: `.github/workflows/release-please.yml`, `release-please-config.json` (package `.` → node, `changelog-path: CHANGELOG.md`), and `.release-please-manifest.json` pinned to `6.1.0` so versioning continues from the current value rather than resetting. Manifest mode is chosen over the legacy single-config because it is the currently-recommended setup and makes future version pinning / multi-package trivial. To chart the now-owned tooling, a new Foundation component `c3-106` (CI & Release Automation) owns `.github/workflows/**` and the release config; this is the right fit because these files are a single delivery-automation concern distinct from the runtime `src/**` components.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-1 | container | Gains a new Foundation component (c3-106, CI & Release Automation — created by this ADR, see Work Breakdown) that charts previously-uncharted .github/workflows/** + release config; the container ## Components and ## Responsibilities must list the CI/release concern | Container README Components + Responsibilities updated (Parent Delta: updated); c3 check clean |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| N.A - no existing ref governs delivery tooling | The four refs (content-schema, i18n-strategy, tailwind-design-system, og-image-generation) all scope to src/** runtime concerns; none govern CI/release YAML or JSON | N.A |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-prettier-format | CI step bun run format:check runs prettier --check . across the repo, so the new JSON/YAML config is checked unless prettier-ignored | comply — run prettier --write on the new files and confirm bun run format:check exits 0 |
| N.A - rule-no-console not applicable | The added files are declarative YAML/JSON with no executable JavaScript, so the no-console.* rule has nothing to govern | N.A |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| CI/CD workflow | Add .github/workflows/release-please.yml: release-please-action@v4 on push: main, permissions: contents+pull-requests write, token: GITHUB_TOKEN | new workflow file |
| Release config | Add release-please-config.json: manifest mode, package . → release-type: node, changelog-path: CHANGELOG.md | new config file |
| Version manifest | Add .release-please-manifest.json → {".":"6.1.0"} to continue from current version | new manifest file |
| C3 docs | c3 add component ci-release --container c3-1 (Foundation 106); update container c3-1 ## Components/## Responsibilities; c3 set c3-106 codemap '.github/workflows/**' etc. | c3 list, c3 lookup |
| Format gate | bun run format:check to prove new files comply with rule-prettier-format | command exit 0 |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - no C3 CLI/validator/schema/test change | This ADR adds project delivery tooling and a standard component doc via existing c3 add/set/write commands; it does not modify the c3x binary, schemas, validators, or hints | c3 check passes with no schema/validator edits |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| release-please GitHub Actions workflow | On each push to main, opens/updates a release PR aggregating Conventional Commits; merging it tags + cuts a GitHub Release and bumps package.json + CHANGELOG.md | .github/workflows/release-please.yml; Actions run log |
| release-please-config.json + .release-please-manifest.json | Make release-type and version source deterministic so bumps are reproducible | committed files |
| CI format:check step | Fails the build if the new config files are not prettier-clean | .github/workflows/ci.yml format:check step |
| c3 check + c3-106 codemap | .github/workflows/** + release config now have an owner; c3 lookup resolves them | c3 lookup '.github/workflows/release-please.yml' → c3-106 |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Manual version + hand-edited CHANGELOG | Error-prone and inconsistent with the conventional-commit discipline already enforced via commitizen cz.yaml |
| changesets | Oriented at multi-package npm library publishing; this is a single, non-published static site, so its per-change changeset files add overhead without benefit |
| semantic-release | Auto-publishes on every push with no human gate and is npm-publish centric; the review-via-release-PR gate of release-please suits a personal site better |
| release-please simple (non-manifest) config | Manifest mode is the currently-recommended layout and keeps future version pinning / multi-package changes trivial |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| Release PRs opened with GITHUB_TOKEN do not trigger other workflows (CI won't run on the release PR itself) | Documented in a workflow comment; CI already runs on source feature PRs before merge; can upgrade to a PAT / GitHub App later | Comment present in workflow; observe release PR opens in Actions log |
| First run cuts no release because only chore: commits exist since the 6.1.0 baseline | Expected behavior; manifest pinned to 6.1.0; a release appears once a feat/fix lands | Actions run logs "no release created" until a releasable commit |
| New JSON/YAML files fail the CI prettier format:check | Run prettier --write on them and verify locally before merge | bun run format:check exits 0 |
| Version lineage continues AstroPaper's 6.x rather than resetting | Manifest explicitly pins 6.1.0 as documented starting point; resettable later via a Release-As: commit | .release-please-manifest.json shows 6.1.0 |

## Verification

| Check | Result |
| --- | --- |
| bun run format:check | exits 0 — new config/workflow files are prettier-clean |
| bun run build | succeeds — release-please files do not affect the Astro build |
| c3 check | 0 issues; component c3-106 created and container c3-1 updated |
| c3 lookup '.github/workflows/release-please.yml' | resolves to c3-106 (CI & Release Automation) |
| JSON validity | release-please-config.json and .release-please-manifest.json parse as valid JSON |
| Post-merge Actions run | release-please workflow completes (opens a release PR, or logs no-release) |
