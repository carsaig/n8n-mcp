# Custom Fork Enhancements – v2.11.5-cs.2

This release builds on v2.11.3 with improved CI/CD, safer releases, and Coolify-friendly deployment.

## 🔧 Key Fixes & Improvements (since v2.11.3)

### 🏷️ Safer Release Triggering
- Release workflow now runs only on tag push (`v*`), preventing accidental releases on merges to `main`.
- Version logic respects the pushed tag verbatim; manual dispatch still supported.

### 📝 Auto Release Notes + Compose/Docs PR
- Workflow auto-generates a release note at `docs/custom_builds/release_v2.11.5.cs.2.md`.
- Automation PR updates:
  - `docker-compose.coolify.yml` image tag → `v2.11.5-cs.2`
  - All `docs/**` references to the new image tag

### 🚀 Deployment Statuses & Environment
- GitHub Deployment statuses now target environment: `Coolify` (was `production`).
- Existing Coolify webhook is invoked via 1Password-loaded secret.

### 🐳 Container Publishing
- ARM64-only image published to GHCR
- Dual tags pushed:
  - `ghcr.io/carsaig/n8n-mcp:v2.35.2-cs.1s.11s.10s.9s.8s.7s.6s.5s.4s.2s.1s.2`
  - `ghcr.io/carsaig/n8n-mcp:v2.35.2-cs.1s.11s.10s.9s.8s.7s.6s.5s.4s.2s.1st`

### 🔄 Upstream/Workflow Reliability
- Upstream sync flow: release-based detection; PAT-based pushes; protected workflows supported.
- Required Checks workflow remains fast and deterministic on self-hosted ARM64.
- Permissions fixed for automation PRs (pull-requests/issues: write).

## 📦 Installation

### Docker
```
docker pull ghcr.io/carsaig/n8n-mcp:v2.35.2-cs.1s.11s.10s.9s.8s.7s.6s.5s.4s.2s.1s.2
```

## 🔗 Container Registry
- GHCR: `ghcr.io/carsaig/n8n-mcp:v2.35.2-cs.1s.11s.10s.9s.8s.7s.6s.5s.4s.2s.1s.2`
- `latest` also available for Coolify restart workflows
- Architecture: ARM64

## ✅ Verified Highlights
- Tag-only releases; no accidental main-triggered runs
- Auto-generated release notes and compose/docs bump PR
- GitHub Deployment statuses in `Coolify` env
- GHCR publish (versioned + latest)

## 🔍 Notes for Coolify Users
- If using pinned tags inside Coolify, update the service to the new tag before redeploy.
- Alternatively, use `:latest` and enable "Always pull image" so webhook restarts pull the new digest.

## 🧭 Appendix: Version
- Version: `v2.11.5-cs.2`
- Previous base: `v2.11.3`

