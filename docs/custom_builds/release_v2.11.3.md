# Custom Fork Enhancements

This release includes critical fixes and improvements over the upstream n8n-MCP repository, specifically addressing production deployment issues, MCP protocol compliance and personal customizations to the traffic routing using Traefik on Coolify.

## 🔧 Key Fixes & Improvements

### ✅ MCP Schema Compliance (Critical Fix)

*   **Fixed multiple MCP tools failing with error -32600** in strict MCP clients (ChatWise, Augment)
*   **Tools fixed**: `validate_workflow`, `validate_workflow_connections`, `validate_workflow_expressions`, `validate_node_minimal`, `validate_node_operation`, `list_ai_tools`, `list_node_templates`
*   **Added** `**structuredContent**` **field** for tools with `outputSchema` as required by MCP specification
*   **Implemented sanitization logic** in HTTP server execution path where validation tools actually run
*   **Dependency-Checked** ensuring no breaking changes to existing functionality apply
*   **Compatibility** with Augment and Chat Client ChatWise (Claude Desktop compliance unchanged)

### 🐳 ARM64 Docker Support

*   **ARM64 container builds** for apple Silicon and Oracle VPS
*   **Added custom docker-compose file** for Coolify & Dokploy and Cloudflare proxy compliance

### 🔧 Added Custom Traefik Configuration & Cloudflare Proxy

*   **Dual routing setup** in docker-compose.coolify.yml to enable routing to the mcp-server endpoint (/\_\_upstream/mcp) directly or via the cloudflare proxy (mcp-n8n.yourdomain.com/mcp) when using URL params for authentication.
*   **Upstream MCP access**: `/__upstream/mcp` path with strip prefix middleware
*   **Cloudflare proxy routing**: `/mcp` path for cloudflare route
*   **Cloudflare → Traefik → Container** traffic flow support to enable apiKey Validation via URL Param. instead of header Bearer Auth or oAuth.
*   **Custom labels** for complex proxy scenarios
*   **Example:** https://mcp-n8n.yourdomain.com/mcp?apiKey=your-api-key-here
*   Added support for apiKey Auth via URL Param using a custom Cloudflare Proxy

### 📚 Updated Documentation

*   **Added bugfix documentation** with root cause analysis
*   **Updated CHANGELOG** with detailed technical information
*   **Version alignment** with upstream release cycle (v2.11.3)

### 🔄 Upstream Synchronization

*   **Latest n8n dependencies included** (v1.111.0) with 535 nodes (17.09.2025)
*   **integrated latest upstream improvements** while preserving all custom fixes
*   **Upstream features preserved**: Template system enhancements with fuzzy matching and metadata (not custom)

## What's Different from Upstream

| Feature | Upstream | This Fork |
| --- | --- | --- |
| **MCP Validation Tools** | ❌ Broken (MCP error -32600) | ✅ **Working** |
| **Other fixed Tools** | ❌ Broken | ✅ **Working** |
| **ARM64 Support** | ❌ Not available | ✅ **Supported** |
| **Coolify & Dokploy compliance** | ❌ Not available | ✅ **Working** |
| **API-Key Auth via URL Param** | ❌ Not available | ✅ **Working** |

## 📦 Installation

### Docker (Recommended)

```
docker pull ghcr.io/carsaig/n8n-mcp:v2.30.2-cs.6s.5s.4s.2s.1s.3s.2
```

## 🔗 Container Registry

*   **GitHub Container Registry**: `ghcr.io/carsaig/n8n-mcp:v2.30.2-cs.6s.5s.4s.2s.1s.3s.2`
*   **Architecture**: Supports ARM64 only
*   **Production-ready**: Tested on Coolify, Dokploy and Docker Compose

## ✅ Verified Functionality

*   ✅ All validation tools working
*   ✅ MCP schema compliance verified
*   ✅ ARM64 image architecture
*   ✅ Coolify & Dokploy deployment
*   ✅ API-Key auth via URL param and cloudflare proxy

## 🔍 Technical Details

### Files Modified

*   `src/http-server.ts` - Added MCP schema compliance sanitization
*   `src/mcp/server.ts` - Added `getToolDefinition()` method
*   `Dockerfile` - Multi-stage ARM64 optimized build
*   `docs/CHANGELOG.md` - Comprehensive change documentation

### Files Added

*   `docs/CHANGELOG.md` - Comprehensive change documentation
*   `docs/bugfixes/bugfixes.md` - Detailed root cause analysis
*   `docs/custom_builds/release_notes.md` - Detailed release notes
*   proxy/cloudflare\_worker.js - Cloudflare Worker for apiKey auth traversal to header-auth using bearer token.
*   docker-compose.coolify.yml - Custom Traefik configuration for Coolify & Dokploy
*   proxy/README.md - Documentation for proxy setup on Cloudflare

### Testing Strategy

*   **Local validation** bare-metal and Docker Compose
*   **Multi-client testing** (Claude Desktop, ChatWise, Augment, VSCode)
*   **Container deployment** on Coolify (ARM64)
*   **End-to-end verification** of all validation tools

### Deployment Verification

*   **Coolify platform** - ARM64 production deployment
*   **Docker Compose** - Local development testing
*   **GitHub Container Registry** - Multi-architecture publishing

### Known issues

*   **Claude Desktop** - When adding the n8n-mcp via Claude Config file, u're set. All good. If you add the n8n-mcp as a custom Connector in the Claude desktop UI, the tools are not discovered. That's a known bug in Claude awaiting a fix upstream.
*   **Cloudflare Worker** - The cloudflare\_worker.js file is not yet optimized for production use. It still contains a lot of debug logging and is not minified. It also needs to be configured with your n8n-mcp backend URL.

---

**This fork addresses critical production issues while maintaining full compatibility with the upstream project. All fixes have been tested and documented**

## 📋 Migration from Upstream

If you're migrating from the upstream n8n-MCP repository:

1.  **Replace container image**: `ghcr.io/carsaig/n8n-mcp:v2.30.2-cs.6s.5s.4s.2s.1s.3s.2`
2.  **No configuration changes needed** - drop-in replacement
3.  **Validation tools will work immediately** - no additional setup
4.  **ARM64 support enabled** - works on Apple Silicon and ARM servers