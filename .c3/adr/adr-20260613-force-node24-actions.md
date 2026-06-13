---
id: adr-20260613-force-node24-actions
c3-seal: b9f9b7f27de53fdc7d8183c0e57834b1967e3614adf123d58a92ba0e3badd3a0
title: force-node24-actions
type: adr
goal: 'Opt the GitHub Actions JavaScript actions used by the CI and deploy workflows into the Node.js 24 runtime ahead of GitHub''s Node 20 runner deprecation, by setting `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` at the workflow level of `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.'
status: implemented
date: "2026-06-13"
---

## Goal

Opt the GitHub Actions JavaScript actions used by the CI and deploy workflows into the Node.js 24 runtime ahead of GitHub's Node 20 runner deprecation, by setting `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` at the workflow level of `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.

## Context

The deploy run on main emitted a GitHub annotation: `actions/checkout@v4`, `actions/configure-pages@v5`, and `actions/upload-artifact@v4` (pulled in by `upload-pages-artifact@v3`) run on Node.js 20, whose runner runtime GitHub forces to Node 24 by default on 2026-06-16 and removes entirely on 2026-09-16. Both `ci.yml` and `deploy.yml` (component c3-106 ci-release) consume the same Node-20 actions, so both surface the warning. The action versions themselves still declare `using: node20`, so the version cannot be raised per-step; GitHub documents `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` as the runner-level opt-in. No workflow contract, trigger, or permission changes.

## Decision

Add a workflow-level `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to both `ci.yml` and `deploy.yml`. This forces every JS action in those workflows onto Node 24 now, regardless of each action's declared runtime, clearing the deprecation warning and de-risking the 2026-06-16 forced cutover. Preferred over bumping action majors because `node24`-native majors of these actions are not all released yet, whereas the env var is GitHub's own documented immediate remedy and applies uniformly.

## Affected Topology

| Entity | Type | Why affected | Governance review |
| --- | --- | --- | --- |
| c3-106 | component | Owns .github/workflows/ci.yml and deploy.yml; both gain the Node 24 opt-in env var | Confirm Contract/Owned files unchanged (runtime hardening only); no Parent Delta expected |

## Compliance Refs

| Ref | Why required | Action |
| --- | --- | --- |
| N.A - no ref governs CI runner runtime; content schema, i18n, OG, and design-system refs are untouched | N.A | N.A |

## Compliance Rules

| Rule | Why required | Action |
| --- | --- | --- |
| rule-prettier-format | The edited workflow YAML must stay prettier-clean | comply |
| N.A - rule-no-console does not apply: no runtime JS is added, only workflow YAML | N.A | N.A |

## Work Breakdown

| Area | Detail | Evidence |
| --- | --- | --- |
| Deploy workflow | Add top-level env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true to deploy.yml | .github/workflows/deploy.yml |
| CI workflow | Add the same top-level env block to ci.yml | .github/workflows/ci.yml |

## Underlay C3 Changes

| Underlay area | Exact C3 change | Verification evidence |
| --- | --- | --- |
| N.A - no C3 CLI/validator/schema change | N.A - workflow runtime config only | N.A - c3 check after edits is the only C3 interaction |

## Enforcement Surfaces

| Surface | Behavior | Evidence |
| --- | --- | --- |
| Actions run logs | The Node 20 deprecation annotation no longer appears on CI/deploy runs | GitHub Actions run after merge |
| ci.yml format:check | prettier --check . fails the PR if the edited YAML is not prettier-clean | .github/workflows/ci.yml |

## Alternatives Considered

| Alternative | Rejected because |
| --- | --- |
| Bump each action to a node24-native major | Those majors are not all released at this date; the env var is the documented immediate fix and covers every action at once |
| Do nothing until the 2026-06-16 forced migration | Leaves a standing deprecation warning and risks an unmanaged forced cutover during a real deploy |
| Set the env var per-step instead of per-workflow | More verbose and easy to miss a step; workflow-level scope guarantees uniform coverage |

## Risks

| Risk | Mitigation | Verification |
| --- | --- | --- |
| An action misbehaves on Node 24 | The change is reversible by removing one env line; the actions are GitHub-maintained and Node 24-compatible | Post-merge deploy run completes green with no annotation |
| Env var typo silently no-ops | Copy the exact documented variable name; confirm the warning is gone on the next run | Actions run shows no Node 20 deprecation annotation |

## Verification

| Check | Result |
| --- | --- |
| bun run format:check | Exits 0 (workflow YAML prettier-clean) |
| c3 check after edits | 0 issues |
| Post-merge deploy run on main | Green, with no Node 20 deprecation annotation |
