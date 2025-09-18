# GitHub Workflows: Policies, Checks, and Upstream Sync

This document describes the fork-specific workflows that protect customizations, enforce required checks, and safely synchronize from the upstream repository.

## Required Checks Workflow (.github/workflows/required-checks.yml)

Purpose:
- Gate all PRs and pushes to main with type checks, unit tests, and project validators
- Enforce protection for fork customizations declared in `.github/customizations.yml`
- Provide an informational impact analysis based on `impact_watch` and `tracked_deltas`

Key behavior:
1) Policy job (pull_request only)
   - Reads `.github/customizations.yml`
   - Extracts all `customizations[].paths` entries
   - Uses GitHub API to list changed files in the PR
   - If any protected path is changed without PR label `customization-change`, the job fails
2) Checks job (always)
   - `npm ci`
   - `npm run typecheck`
   - `npm test -- --run`
   - `npm run validate`

Notes:
- The policy job uses actions/github-script (Node) to avoid external dependencies on the runner
- For approval requirements (e.g. CODEOWNERS), configure branch protection rules in GitHub settings

## Upstream Sync Workflow (.github/workflows/upstream-sync.yml)

Purpose:
- Periodically (or manually) fetch, merge and raise a PR that syncs `upstream/main` into this fork
- Labels the PR as `upstream-sync` and `dependencies`
- Relies on the Required Checks workflow to evaluate policy and run validations

Key behavior:
- Creates/updates branch `chore/upstream-sync`
- Opens a PR with labels so policy and checks are applied consistently
- Auto-merge can be enabled when checks are green

## Customizations Manifest (.github/customizations.yml)

This manifest drives policy and impact analysis. Structure:
- `policies`: description of gating logic and checks
- `checks`: named commands (typecheck, unit-tests, workflow-validators)
- `mirrors`: parts that upstream owns (e.g. upstream-workflows/**)
- `customizations[]`: protected groups with `paths`, optional `checksums`, and optional `impact_watch`
- `tracked_deltas`: additional files that differ from upstream for broader impact detection

Maintenance hints:
- When you intentionally update a protected file, add `customization-change` label to the PR
- For critical files with checksums, update the hash in the manifest in the same PR
- Add new customizations or tracked paths in the manifest as your fork evolves

## Operational Recommendations

- Use CODEOWNERS to require explicit review for sensitive paths (e.g. MCP server files, workflows)
- Keep `required-checks.yml` minimal and deterministic; avoid environment surprises on self-hosted runners
- Prefer manifest-driven enforcement over duplicated path lists inside workflows
- For non-trivial upstream changes, review impact hits printed by the policy job and expand tests where necessary

