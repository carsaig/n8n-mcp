# Fork Customization Change Log

Date: 2025-12-22

## Context

*   Goal: merge `upstream/main` into fork `main` while preserving fork-specific deployment workflow, HTTP validation fixes, and Dockerfile.
*   Constraint: upstream is source of truth for code/content except for explicitly preserved fork customizations.

## Decisions

*   Keep fork deployment workflows under `.github/workflows/*`; ignore upstream workflow set.
*   Keep fork `Dockerfile` to preserve ARM64 build/release process.
*   Keep fork HTTP validation sanitization in `src/http-server.ts`.
*   Take upstream for the rest of the codebase unless explicitly required for fork fixes.
*   Preserve local edits in `AGENTS.md` and `CLAUDE.md`.
*   Ignore local `.github/copilot-instructions.md` changes (not used).

## Actions Performed

*   Merged `upstream/main` into local `main`.
*   Resolved conflicts by preferring fork versions for:
    *   `.github/workflows/*`
    *   `Dockerfile`
    *   `src/http-server.ts`
*   Resolved conflicts by preferring upstream for:
    *   `README.md`, `docs/CHANGELOG.md`, `MEMORY_N8N_UPDATE.md`, `package.json`, `package-lock.json`, `src/mcp/server.ts`
*   Re-added `getToolDefinition` to `src/mcp/server.ts` after taking upstream to support HTTP validation sanitization.
*   Removed upstream workflow additions under `.github/workflows/upstream-workflows/` and `dependency-check.yml`.
*   Restored local `AGENTS.md` and `CLAUDE.md` changes after stash pop conflict resolution.

## Key Files Touched

*   `.github/workflows/release.yml`
*   `.github/workflows/required-checks.yml`
*   `.github/workflows/upstream-sync.yml`
*   `Dockerfile`
*   `src/http-server.ts`
*   `src/mcp/server.ts`
*   `AGENTS.md`
*   `CLAUDE.md`

## Notes

*   Push to `origin/main` was blocked by repository rules: 2 required status checks missing.
*   Merge commit created locally: `ba9212e`.
*   Next step: push to a PR branch to satisfy required checks, or adjust rules and re-push to `main`.