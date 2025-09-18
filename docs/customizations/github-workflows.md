# GitHub Workflows: Policies, Checks, and Upstream Sync

This document describes the fork-specific workflows that protect customizations, enforce required checks, and safely synchronize from the upstream repository.

## Required Checks Workflow (.github/workflows/required-checks.yml)

Purpose:

*   Gate all PRs and pushes to main with type checks, unit tests, and project validators
*   Enforce protection for fork customizations declared in `.github/customizations.yml`
*   Provide an informational impact analysis based on `impact_watch` and `tracked_deltas`

Key behavior:

1.  Policy job (pull\_request only)
    *   Reads `.github/customizations.yml` (if missing: warns and skips enforcement)
    *   Lists changed files via GitHub API
    *   Fetches PR labels via API (avoids stale event payload)
    *   If a protected path requires label `customization-change` and it's missing, the job fails
2.  Checks job (pull\_request and push to `main`)
    *   Setup Node.js 20.x with npm cache
    *   Install deps: `npm install --no-audit --no-fund --prefer-offline --legacy-peer-deps`
    *   Typecheck: `npm run typecheck`
    *   Unit tests: currently skipped in CI for stability
    *   Build: `npm run build`
    *   Validators: `npm run validate`

Notes:

*   The policy job uses `actions/github-script` (Node) and queries the GitHub API directly
*   Use GitHub rulesets/branch protection to require these status checks; approvals are optional by your preference
*   Runner: self-hosted linux/arm64; keep workflow minimal/deterministic for reliability

## Upstream Sync Workflow (.github/workflows/upstream-sync.yml)

Purpose:

*   Periodically (or manually) fetch, merge and raise a PR that syncs `upstream/main` into this fork
*   Labels the PR as `upstream-sync` and `dependencies`
*   Relies on the Required Checks workflow to evaluate policy and run validations

Key behavior:

*   Creates/updates branch `chore/upstream-sync`
*   Opens a PR with labels so policy and checks are applied consistently
*   Auto-merge can be enabled when checks are green

## Customizations Manifest (.github/customizations.yml)

This manifest drives policy and impact analysis. Structure:

*   `policies`: description of gating logic and checks
*   `checks`: named commands (typecheck, unit-tests, workflow-validators)
*   `mirrors`: parts that upstream owns (e.g. upstream-workflows/\*\*)
*   `customizations[]`: protected groups with `paths`, optional `checksums`, and optional `impact_watch`
*   `tracked_deltas`: additional files that differ from upstream for broader impact detection

Maintenance hints:

*   When you intentionally update a protected file, add `customization-change` label to the PR
*   For critical files with checksums, update the hash in the manifest in the same PR
*   Add new customizations or tracked paths in the manifest as your fork evolves

## Operational Recommendations

*   Use CODEOWNERS to require explicit review for sensitive paths (e.g. MCP server files, workflows)

## Step-by-step runbook: checks and rules (concise)

Step 0: Trigger

*   Action: Open/update a PR, or push to `main`.
*   Why: Gate changes with policy and checks.
*   Effect: On PRs, both jobs run; on `main` pushes, only the checks job runs.

Step 1: Policy job (PR only)

*   Actions:
    *   Checkout the PR code
    *   Read `.github/customizations.yml` (warn and skip if missing)
    *   List changed files via GitHub API
    *   Fetch PR labels via GitHub API (fresh, non-stale)
    *   Match changed files against protected paths from the manifest
*   Why: Ensure sensitive/customized areas are only changed intentionally
*   Effect:
    *   If protected paths changed and label `customization-change` is absent → job fails
    *   Otherwise → job passes (may emit warnings for soft-guard paths)

Step 2: Checks job (PRs and `main`)

*   Actions:
    *   Setup Node.js 20.x (with npm cache)
    *   Install deps: `npm install --no-audit --no-fund --prefer-offline --legacy-peer-deps`
    *   Typecheck: `npm run typecheck`
    *   Tests: currently skipped in CI for stability
    *   Build: `npm run build`
    *   Validators: `npm run validate`
*   Why: Fast, deterministic signal that the project compiles and passes validators on the runner
*   Effect: Produces the required status checks gating merges

Step 3: Merge and required rules

*   Actions:
    *   GitHub ruleset/branch protection requires successful “Required Checks” statuses
    *   No mandatory approvals (per your preference); CODEOWNERS can still be used if desired
*   Why: Keep merges unblocked for solo operation while retaining CI gating
*   Effect: You can merge as soon as both statuses are green

Step 4: After merge to `main`

*   Actions: The checks job runs on `main` again (build + validators)
*   Why: Post-merge smoke to ensure `main` remains healthy
*   Effect: Confirms deployable state

Step 5: Branch cleanup

*   Actions:
    *   Auto-delete of head branches on merge is enabled at repo level
    *   Manual cleanup is done for older branches if any remain
*   Why: Keep the repo tidy
*   Effect: No stale branches after merges
*   Keep `required-checks.yml` minimal and deterministic; avoid environment surprises on self-hosted runners
*   Prefer manifest-driven enforcement over duplicated path lists inside workflows
*   For non-trivial upstream changes, review impact hits printed by the policy job and expand tests where necessary