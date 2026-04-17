# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in n8n-mcp, please report it through [GitHub's private vulnerability reporting](https://github.com/czlonkowski/n8n-mcp/security/advisories/new). Do not create public issues for security vulnerabilities.

## Supported Versions

<<<<<<< HEAD
### 1\. Environment Variables
=======
Only the latest release receives security patches. We recommend always running the latest version.
>>>>>>> 217d737aa56cab94ee432026d71a9fa6044a1367

## Response Process

<<<<<<< HEAD
*   Use `.env` files for local development (already in `.gitignore`)
*   Use `.env.example` as a template with placeholder values
*   Generate strong tokens using: `openssl rand -base64 32`

### 2\. API Keys and Tokens

*   **Rotate credentials immediately** if they are exposed
*   Use environment variables exclusively - no hardcoded fallbacks
*   Implement proper token expiration when possible
*   Use least-privilege access for API keys

### 3\. Code Security

#### ❌ DON'T DO THIS:

```typescript
// NEVER hardcode credentials
const apiKey = process.env.N8N_API_KEY || 'n8n_api_actual_key_here';
const apiUrl = process.env.N8N_API_URL || 'https://production-url.com';
```

#### ✅ DO THIS INSTEAD:

```typescript
// Always require environment variables
const apiKey = process.env.N8N_API_KEY;
const apiUrl = process.env.N8N_API_URL;

if (!apiKey || !apiUrl) {
  console.error('Error: Required environment variables are missing');
  process.exit(1);
}
```

### 4\. Git Security

Before committing, always check:

```
# Check for tracked sensitive files
git ls-files | grep -E "\.(env|pem|key|cert)$"

# Check staged changes for secrets
git diff --staged | grep -iE "(api[_-]?key|secret|token|password)"
```

### 5\. Docker Security

*   Never include `.env` files in Docker images
*   Use build arguments for compile-time configuration
*   Use runtime environment variables for secrets
*   Run containers as non-root users

### 6\. Dependencies

*   Regularly update dependencies: `npm audit`
*   Review dependency changes carefully
*   Use lock files (`package-lock.json`)
*   Monitor for security advisories

## Security Checklist

Before each release or deployment:

*   No hardcoded credentials in source code
*   All sensitive configuration uses environment variables
*   `.env` files are not tracked in git
*   Dependencies are up to date
*   No sensitive data in logs
*   API endpoints use proper authentication
*   Docker images don't contain secrets

## Known Security Considerations

1.  **MCP Authentication**: When running in HTTP mode, always use strong `AUTH_TOKEN` values
2.  **n8n API Access**: The n8n API key provides full access to workflows - protect it carefully
3.  **Database Access**: The SQLite database contains node information but no credentials

## Tools for Security

*   **SecureKeyGuard**: Automated scanning for exposed secrets
*   **npm audit**: Check for vulnerable dependencies
*   **git-secrets**: Prevent committing secrets to git
*   **dotenv-vault**: Secure environment variable management

Remember: Security is everyone's responsibility. When in doubt, ask for a security review.
=======
1. We will acknowledge your report within 72 hours
2. We will investigate and determine severity
3. If confirmed, we will develop and release a fix
4. We will credit reporters in the advisory (unless they prefer otherwise)

For the full incident response process, see our [Incident Response Plan](.github/INCIDENT_RESPONSE.md).

## Scope

n8n-mcp is a proxy to the n8n REST API. The security boundary is n8n itself, not n8n-mcp. Reports about capabilities that are inherent to the n8n API (e.g., creating workflows with Code nodes) are out of scope, as n8n-mcp does not grant any capability beyond what the n8n API already provides.

In-scope examples:
- Authentication bypass in the MCP HTTP transport
- Information disclosure (credential leaks, token exposure)
- Injection vulnerabilities in n8n-mcp's own code
- Dependency vulnerabilities with a viable exploit path

Out-of-scope examples:
- n8n platform capabilities accessible through any n8n API client
- General LLM prompt injection risks (these affect all MCP servers equally)
- Denial of service through normal API usage

<<<<<<< HEAD
For deployment hardening guidance, see the [Security & Hardening guide](./docs/SECURITY_HARDENING.md).
>>>>>>> 217d737aa56cab94ee432026d71a9fa6044a1367
=======
For deployment hardening guidance, see the [Security & Hardening guide](./docs/SECURITY_HARDENING.md). For the STRIDE threat model, see [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md).
>>>>>>> 7b3ccb10ca70a7d8b8ecdf772199abdf28ef814d
