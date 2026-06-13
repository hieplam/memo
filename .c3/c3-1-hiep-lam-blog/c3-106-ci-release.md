---
id: c3-106
c3-seal: cac29ae00bb522dfbd4a1118025f56d69a855db9a32293008f855c1da896ecc5
title: ci-release
type: component
category: foundation
parent: c3-1
goal: Automate continuous-integration checks and conventional-commit-driven releases for the blog via GitHub Actions.
uses:
    - rule-prettier-format
---

## Goal

Automate continuous-integration checks and conventional-commit-driven releases for the blog via GitHub Actions.

## Parent Fit

| Field | Value |
| --- | --- |
| Container | Hiep Lam Blog (c3-1) |
| Category | Foundation (06) |
| Owned files | .github/workflows/ci.yml, .github/workflows/deploy.yml, .github/workflows/release-please.yml, release-please-config.json, .release-please-manifest.json |
| Depended on by | All components — the delivery gate (lint/format/build), the GitHub Pages deployment, and the release process apply repo-wide |

## Purpose

Owns the GitHub Actions delivery pipeline. ci.yml runs eslint, prettier --check, and the bun-based Astro build on every push and pull request; deploy.yml builds the site with bun and publishes the dist/ artifact to GitHub Pages on every push to main (served at https://hieplam.github.io/memo/); release-please.yml together with release-please-config.json and .release-please-manifest.json automate version bumps, CHANGELOG.md generation, git tags, and GitHub Releases derived from Conventional Commit messages. Does NOT own application source or the Astro build configuration (astro.config.ts / astro-paper.config.ts) — it consumes the package.json build script as a black box.

## Foundational Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Preconditions | A bun-installable project exposing package.json scripts (lint, format:check, build) must exist | c3-1 |
| Inputs | Git push and pull_request events on main, plus Conventional Commit messages since the last release tag | c3-1 |
| State | Release state persisted in .release-please-manifest.json (current version) and git tags | c3-1 |
| Shared deps | GitHub Actions runners, oven-sh/setup-bun, googleapis/release-please-action@v4 | c3-1 |

## Business Flow

| Aspect | Detail | Reference |
| --- | --- | --- |
| Primary path (CI) | On push/PR, ci.yml installs deps with bun and runs lint + format:check + build; a failure blocks merge | c3-1 |
| Primary path (release) | On push to main, release-please opens or updates a release PR aggregating Conventional Commits | c3-1 |
| Release cut | Merging the release PR bumps package.json + CHANGELOG.md, tags the commit, and publishes a GitHub Release | c3-1 |
| Failure behavior | No releasable commits → release-please logs no-release and opens no PR; CI failure surfaces as a red status check | c3-1 |

## Governance

| Reference | Type | Governs | Precedence | Notes |
| --- | --- | --- | --- | --- |
| adr-20260608-adopt-release-please | adr | Decision to adopt release-please in manifest mode with release-type node | Primary | Records token choice, version continuity from 6.1.0, and rejected alternatives |
| rule-prettier-format | rule | Workflow YAML under .github must be prettier-clean (whitelisted in .prettierignore) | Secondary | Root JSON config is prettier-ignored and rewritten by release-please |

## Contract

| Surface | Direction | Contract | Boundary | Evidence |
| --- | --- | --- | --- | --- |
| ci.yml status checks | OUT | Lint, format check, and build must pass before a PR merges to main | GitHub PR status checks | .github/workflows/ci.yml |
| deploy.yml Pages deployment | OUT | On push to main (or manual dispatch), builds with bun and publishes dist/ to GitHub Pages at https://hieplam.github.io/memo/; a build failure blocks the deploy job | GitHub Pages (github-pages environment) | .github/workflows/deploy.yml |
| release-please PR | OUT | Produces a version bump + CHANGELOG entry + GitHub Release when merged | git tags / GitHub Releases | .github/workflows/release-please.yml + release-please-config.json |

## Change Safety

| Risk | Trigger | Detection | Required Verification |
| --- | --- | --- | --- |
| Release PR never appears | Misconfigured manifest/config, or only non-releasable commit types since baseline | release-please Actions run shows no PR created | Inspect Actions log; confirm a feat/fix commit lands and a release PR opens |
| CI passes locally but fails in Actions | bun version or setup-bun drift between local and runner | Red status check on the PR | Re-run bun run lint && bun run format:check && bun run build locally and reconcile against .github/workflows/ci.yml |

## Derived Materials

| Material | Must derive from | Allowed variance | Evidence |
| --- | --- | --- | --- |
| GitHub Releases + CHANGELOG.md entries | Business Flow section: the release-cut path where release-please aggregates Conventional Commits into a version bump | Version number per the semver bump implied by commit types | .release-please-manifest.json + CHANGELOG.md |
