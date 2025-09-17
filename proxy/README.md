## Pre-requisits:

*   This guide assumes you use cloudflare for your domain DSN management
*   custom subdomain configured in cloudflare DNS settings for cloudflare worker. i.e.: n8n-mcp.mydomain.com 
*   customize the target domain in the cloudflare\_worker.js to match your domain.

## Configuration in Cloudflare:

*   create a route to point to the worker script.
*   create a caching rule that excludes all traffic concerning the mcp-server sub-domain
*   create a security rule to exclude all traffic concerning the mcp-server from the WAF
*   Make sure, no other rule overrules or influences your new rules!
*   deploy the worker

## Configuration in MCP Chat Client:

*   use your custom URL in any Chat Client or AI Agent to connect to the n8n-mcp server: https://n8n-mcp.yourdomain.com/mcp?apiKey=\<your\_key>