// Cloudflare Worker: WebSocket + HTTP MCP proxy for Claude Desktop
// - Handles WebSocket upgrade with 'mcp' subprotocol
// - Injects Authorization from ?apiKey=...
// - Boots MCP lifecycle locally so Claude lists tools
// - Proxies tools/* and other calls to backend HTTP endpoint

export default {
  async fetch(request, env, ctx) {
    try {
      const inUrl = new URL(request.url);

      // FORCE CACHE BYPASS for WebSocket upgrade requests
      // Cloudflare cache is preventing Worker execution
      const wsKeyHeader = request.headers.get('Sec-WebSocket-Key');
      const wsProtocolHeader = request.headers.get('Sec-WebSocket-Protocol');

      if (wsKeyHeader && wsProtocolHeader?.includes('mcp')) {
        console.log('🚫 BYPASSING CACHE for WebSocket upgrade request');
        // Add cache-busting headers to force Worker execution
        const modifiedRequest = new Request(request.url + '&ws_bypass=' + Date.now(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        return handleRequest(modifiedRequest);
      }

      return handleRequest(request);
    } catch (error) {
      console.error('❌ Worker Error:', error);
      return new Response(`Worker Error: ${error.message}`, { status: 500 });
    }
  }
};

async function handleRequest(request) {
  try {
    const inUrl = new URL(request.url);
      // Per-isolate state for HTTP session gating
      const globalState = (globalThis.__mcp_state = globalThis.__mcp_state || { sessions: new Map() });
      async function stableSessionIdFromKey(key) {
        const enc = new TextEncoder();
        const hash = await crypto.subtle.digest('SHA-256', enc.encode(key));
        const bytes = new Uint8Array(hash).slice(0, 16);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // v4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
        const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'));
        return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10,16).join('')}`;
      }

      // ---- Config ----
      // Hard-coded upstream (same host as public, but different path to bypass Worker route via Traefik StripPrefix)
      // Cloudflare route handles /mcp* on mcp-n8n.yourdomain.com. We call /__upstream/mcp to reach Traefik directly.
      const BACKEND_ORIGIN = 'https://mcp-n8n.yourdomain.com';
      const upstreamUrl = new URL(BACKEND_ORIGIN);
      const inPath = new URL(request.url).pathname;
      const targetPath = inPath.startsWith('/mcp') ? '/__upstream/mcp' : inPath;
      upstreamUrl.pathname = targetPath;

      const PROTOCOL_VERSION = '2025-06-18';
      // Track negotiated protocol version per WS session; default to latest
      let currentProtocolVersion = PROTOCOL_VERSION;
      const initCapabilities = {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
        sampling: {}
      };

      // Extract API key from URL parameters
      const apiKey = inUrl.searchParams.get('apiKey') || inUrl.searchParams.get('k');
      console.log(`🔑 API Key extracted: ${apiKey ? 'YES' : 'NO'}`);

      // ---- WebSocket Upgrade Handling ----
      const upgradeHeader = request.headers.get('Upgrade');
      const connectionHeader = request.headers.get('Connection');
      const wsKeyHeader = request.headers.get('Sec-WebSocket-Key');
      const wsProtocolHeader = request.headers.get('Sec-WebSocket-Protocol');
      console.log(`🔍 Headers - Upgrade: ${upgradeHeader}, Connection: ${connectionHeader}, WebSocket-Key: ${wsKeyHeader}, Protocol: ${wsProtocolHeader}`);
      console.log(`🔍 Request Method: ${request.method}, URL: ${request.url}`);
      console.log(`🔍 All Headers:`, Object.fromEntries(request.headers.entries()));

      // Prevent recursion only when upstream also targets /mcp on same host
      if (upstreamUrl.hostname === inUrl.hostname && upstreamUrl.pathname.startsWith('/mcp')) {
        console.error(`❌ Potential recursion detected: BACKEND_ORIGIN (${upstreamUrl.hostname}) matches request host (${inUrl.hostname}) for /mcp path. Use a different subdomain for BACKEND_ORIGIN that routes directly to Traefik (no Worker route).`);
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Server misconfiguration: BACKEND_ORIGIN causes recursion' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      // Utility: sanitize tools payload to strict MCP shape
      const sanitizeToolsPayload = (result) => {
        try {
          const rawTools = result && result.tools;
          let toolsArr = Array.isArray(rawTools)
            ? rawTools
            : (rawTools && typeof rawTools === 'object')
              ? Object.values(rawTools)
              : [];

          const safeTools = toolsArr.map((tool) => {
            const base = {
              name: String(tool?.name || ''),
              description: String(tool?.description || ''),
            };

            // inputSchema
            if (tool && typeof tool.inputSchema === 'object') {
              try {
                base.inputSchema = JSON.parse(JSON.stringify(tool.inputSchema));
              } catch {
                base.inputSchema = { type: 'object', properties: {} };
              }
            } else {
              base.inputSchema = { type: 'object', properties: {} };
            }

            // outputSchema (optional)
            if (tool && typeof tool.outputSchema === 'object') {
              try {
                const json = JSON.parse(JSON.stringify(tool.outputSchema));
                if (json && json.type) base.outputSchema = json;
              } catch {
                // ignore if not serializable
              }
            }

            return base;
          });

          return { tools: safeTools };
        } catch (e) {
          console.warn('⚠️ sanitizeToolsPayload failed, returning empty list:', e?.message || e);
          return { tools: [] };
        }
      };

      // CLOUDFLARE-COMPATIBLE WebSocket Detection
      // Cloudflare transforms headers: Upgrade→null, Connection→Keep-Alive
      // We detect WebSocket intent using preserved headers: Sec-WebSocket-Key + Sec-WebSocket-Protocol
      const isWebSocketUpgrade =
        wsKeyHeader &&                           // Sec-WebSocket-Key preserved by Cloudflare
        wsProtocolHeader?.includes('mcp') &&     // Sec-WebSocket-Protocol preserved by Cloudflare
        request.method === 'GET';                // WebSocket upgrades must be GET requests

      // FALLBACK: Also check traditional headers for non-Cloudflare environments
      const isTraditionalWebSocketUpgrade =
        upgradeHeader?.toLowerCase() === 'websocket' &&
        connectionHeader?.toLowerCase().includes('upgrade') &&
        wsKeyHeader &&
        wsProtocolHeader?.includes('mcp');

      const finalWebSocketUpgrade = isWebSocketUpgrade || isTraditionalWebSocketUpgrade;

      console.log(`🔍 WebSocket Upgrade Check:`, {
        upgradeHeader: upgradeHeader?.toLowerCase(),
        connectionHeader: connectionHeader?.toLowerCase(),
        hasWsKey: !!wsKeyHeader,
        wsKeyValue: wsKeyHeader,
        protocolIncludes: wsProtocolHeader?.includes('mcp'),
        protocolValue: wsProtocolHeader,
        method: request.method,
        url: request.url,
        cloudflareCompatible: isWebSocketUpgrade,
        traditional: isTraditionalWebSocketUpgrade,
        finalResult: finalWebSocketUpgrade
      });

      if (finalWebSocketUpgrade) {
        console.log(`✅ WebSocket upgrade detected - Creating WebSocket pair`);
        if (!apiKey) {
          return new Response('Missing API key in URL parameter', { status: 400, headers: { 'Content-Type': 'text/plain' } });
        }

        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);
        server.accept();

        console.log(`🔌 WebSocket connection established with API key`);

        // Simplified direct proxy function
        async function proxyToBackend(messageData) {
          const startTime = Date.now();

          try {
            const traceId = `wrk-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            const backendHeaders = {
              'Content-Type': 'application/json',
              // Force JSON responses; SSE here can cause indefinite reads/timeouts
              'Accept': 'application/json',
              'MCP-Protocol-Version': currentProtocolVersion,
              'Authorization': `Bearer ${apiKey}`,
              'X-Worker-Trace-Id': traceId
            };
            console.log(`↗ upstream(WS): POST ${upstreamUrl} (Accept=${backendHeaders.Accept}, proto=${backendHeaders['MCP-Protocol-Version']}, traceId=${traceId})`);
            const ctrl = new AbortController();
            const TIMEOUT_MS = 15000;
            const timeout = setTimeout(() => ctrl.abort(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
            const response = await fetch(upstreamUrl.toString(), {
              method: 'POST',
              headers: backendHeaders,
              body: messageData,
              signal: ctrl.signal,
              redirect: 'manual'
            });
            clearTimeout(timeout);

            // Explicitly parse based on content-type to avoid hanging on SSE
            const ct = response.headers.get('content-type') || '';
            console.log(`↙ upstream(WS): status=${response.status}, content-type="${ct}" (traceId=${traceId})`);
            let result;
            if (ct.includes('application/json')) {
              result = await response.json();
            } else {
              const text = await response.text();
              try { result = JSON.parse(text); }
              catch {
                console.warn('⚠️ Upstream returned non-JSON content-type; body length:', text.length, 'type:', ct);
                throw new Error(`Unexpected upstream content-type: ${ct}`);
              }
            }
            const duration = Date.now() - startTime;

            // Extract method for logging
            let method = 'unknown';
            try { method = JSON.parse(messageData).method; } catch {}

            console.log(`⏱️ ${method} → ${response.status} in ${duration}ms (traceId=${traceId})`);

            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Proxy error in ${duration}ms:`, error.message);
            throw error;
          }
        }

        // Simplified WebSocket message handler - Direct forwarding
        server.addEventListener('message', async (event) => {
          const startTime = Date.now();

          try {
            // Parse incoming message
            const rawData = event.data;
            let messageData;
            if (typeof rawData === 'string') {
              messageData = rawData;
            } else if (rawData instanceof ArrayBuffer) {
              messageData = new TextDecoder().decode(rawData);
            } else {
              console.warn('⚠️ Unsupported message data type');
              return;
            }

            let jsonRpcMessage;
            try {
              jsonRpcMessage = JSON.parse(messageData);
            } catch (e) {
              console.error('❌ JSON parse error:', e.message);
              server.send(JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32700, message: 'Parse error' }
              }));
              return;
            }

            const { method, id } = jsonRpcMessage;
            console.log(`→ ${method} (id: ${id}) - Start`);

            // Do not respond to JSON-RPC notifications (no id) per spec
            if (id === undefined || id === null) {
              console.log(`↷ Notification received: ${method} (no id) — not forwarding/responding`);
              // Intentionally do not proxy or reply
              return;
            }

            // CRITICAL: Tools discovery should reflect backend and be well-formed
            if (method === 'tools/list') {
              console.log(`🚀 Proxy-path: ${method} - Fetching from backend and sanitizing`);
              try {
                const backend = await proxyToBackend(messageData);
                const sanitized = sanitizeToolsPayload(backend?.result);
                const sample = (sanitized.tools || []).slice(0, 5).map(t => t?.name).filter(Boolean);
                console.log(`🧰 tools/list(WS): sanitized ${sanitized.tools?.length ?? 0} tools; sample=`, sample);
                server.send(JSON.stringify({ jsonrpc: '2.0', id, result: sanitized }));
                const totalDuration = Date.now() - startTime;
                console.log(`← ${method} (id: ${id}) - Proxied + sanitized in ${totalDuration}ms`);
                return;
              } catch (e) {
                console.warn(`⚠️ ${method} proxy failed, returning empty list:`, e?.message || e);
                server.send(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: [] } }));
                return;
              }
            }

            if (method === 'prompts/list') {
              console.log(`🚀 Fast-path: ${method} - Returning empty prompts`);
              const promptsResponse = {
                jsonrpc: '2.0',
                id: id,
                result: { prompts: [] }
              };
              server.send(JSON.stringify(promptsResponse));
              const totalDuration = Date.now() - startTime;
              console.log(`← ${method} (id: ${id}) - Fast-path complete in ${totalDuration}ms`);
              return;
            }

            if (method === 'resources/list') {
              console.log(`🚀 Fast-path: ${method} - Returning empty resources`);
              const resourcesResponse = {
                jsonrpc: '2.0',
                id: id,
                result: { resources: [] }
              };
              server.send(JSON.stringify(resourcesResponse));
              const totalDuration = Date.now() - startTime;
              console.log(`← ${method} (id: ${id}) - Fast-path complete in ${totalDuration}ms`);
              return;
            }

            // Direct proxy to backend for other methods
            try {
              const result = await proxyToBackend(messageData);

              // Update protocol version from initialize response
              if (method === 'initialize' && result?.result?.protocolVersion) {
                currentProtocolVersion = result.result.protocolVersion;
                console.log(`🔄 Protocol version updated to: ${currentProtocolVersion}`);
              }

              // Send response back to client
              server.send(JSON.stringify(result));

              const totalDuration = Date.now() - startTime;
              console.log(`← ${method} (id: ${id}) - Complete in ${totalDuration}ms`);

            } catch (error) {
              const totalDuration = Date.now() - startTime;
              console.error(`❌ ${method} (id: ${id}) - Failed in ${totalDuration}ms:`, error.message);

              server.send(JSON.stringify({
                jsonrpc: '2.0',
                id: id,
                error: {
                  code: -32000,
                  message: `Backend error: ${error.message}`
                }
              }));
            }
          } catch (err) {
            const totalDuration = Date.now() - startTime;
            console.error(`💥 Unexpected error in ${totalDuration}ms:`, err.message);
            server.send(JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: {
                code: -32000,
                message: `Internal error: ${err.message}`
              }
            }));
          }
        });

        // WebSocket connection event logging
        server.addEventListener('close', (event) => {
          console.log(`🔌 WebSocket closed - Code: ${event.code}, Reason: ${event.reason || 'No reason'}`);
        });

        server.addEventListener('error', (event) => {
          console.error('💥 WebSocket error:', event);
        });

        console.log(`✅ WebSocket handlers configured - Ready for messages`);

        return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'mcp', 'Access-Control-Allow-Origin': '*', 'MCP-Protocol-Version': PROTOCOL_VERSION } });
      }

      // ---- Non-WebSocket requests (HTTP/SSE/Health) ----
      console.log(`❌ Not a WebSocket upgrade - Processing as HTTP request`);
      const cleanUrl = new URL(upstreamUrl);
      cleanUrl.searchParams.delete('apiKey');
      cleanUrl.searchParams.delete('k');

      // Health endpoints (Worker and component proxies)
      if (request.method === 'GET' && inUrl.pathname === '/health') {
        const body = {
          status: 'ok',
          role: 'worker',
          protocolVersion: PROTOCOL_VERSION,
          time: new Date().toISOString()
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', ...{'Access-Control-Allow-Origin': '*'} } });
      }
      // Also expose health endpoints under /mcp/* so Cloudflare route (matching /mcp*) reaches the worker without changing routes
      if (request.method === 'GET' && (inUrl.pathname === '/mcp/health' || inUrl.pathname === '/mcp/health/')) {
        const body = {
          status: 'ok',
          role: 'worker',
          scope: 'mcp',
          protocolVersion: PROTOCOL_VERSION,
          time: new Date().toISOString()
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      if (request.method === 'GET' && inUrl.pathname === '/health/mcp') {
        try {
          // Directly query MCP server container public host
          const mcpRes = await fetch('https://mcp-n8n.yourdomain.com/health', { method: 'GET' });
          const txt = await mcpRes.text();
          return new Response(txt, { status: mcpRes.status, headers: { 'Content-Type': mcpRes.headers.get('Content-Type') || 'application/json', 'Access-Control-Allow-Origin': '*' } });
        } catch (e) {
          return new Response(JSON.stringify({ status: 'error', component: 'mcp', message: String(e?.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
      }
      // Alias /health/backend and /health/n8n to backend healthz
      if (request.method === 'GET' && (inUrl.pathname === '/health/n8n' || inUrl.pathname === '/health/backend')) {
        try {
          const n8nRes = await fetch('https://n8n.yourdomain.com/healthz', { method: 'GET' });
          const txt = await n8nRes.text();
          return new Response(txt, { status: n8nRes.status, headers: { 'Content-Type': n8nRes.headers.get('Content-Type') || 'application/json', 'Access-Control-Allow-Origin': '*' } });
        } catch (e) {
          return new Response(JSON.stringify({ status: 'error', component: 'n8n', message: String(e?.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
      }
      // Mirror health proxies under /mcp/health/* to keep Cloudflare route unchanged
      if (request.method === 'GET' && inUrl.pathname === '/mcp/health/mcp') {
        try {
          const mcpRes = await fetch('https://mcp-n8n.yourdomain.com/health', { method: 'GET' });
          const txt = await mcpRes.text();
          return new Response(txt, { status: mcpRes.status, headers: { 'Content-Type': mcpRes.headers.get('Content-Type') || 'application/json', 'Access-Control-Allow-Origin': '*' } });
        } catch (e) {
          return new Response(JSON.stringify({ status: 'error', component: 'mcp', message: String(e?.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
      }
      if (request.method === 'GET' && (inUrl.pathname === '/mcp/health/backend' || inUrl.pathname === '/mcp/health/n8n')) {
        try {
          const n8nRes = await fetch('https://n8n.yourdomain.com/healthz', { method: 'GET' });
          const txt = await n8nRes.text();
          return new Response(txt, { status: n8nRes.status, headers: { 'Content-Type': n8nRes.headers.get('Content-Type') || 'application/json', 'Access-Control-Allow-Origin': '*' } });
        } catch (e) {
          return new Response(JSON.stringify({ status: 'error', component: 'n8n', message: String(e?.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
      }

      const defaultHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
        'WWW-Authenticate': 'Bearer realm="mcp"',
        'MCP-Protocol-Version': PROTOCOL_VERSION,
        'Cache-Control': 'no-store',
        'Strict-Transport-Security': 'max-age=15552000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff'
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: defaultHeaders });
      }

      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { ...defaultHeaders, 'Content-Type': 'application/json' } });
      }

      // SSE keep-alive only for explicit /sse endpoints; otherwise proxy
      const accept = request.headers.get('accept') || '';
      if (request.method === 'GET' && inUrl.pathname.endsWith('/sse') && accept.includes('text/event-stream')) {
        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(': ready\n\n'));
            const t = setInterval(() => controller.enqueue(enc.encode(': keep-alive\n\n')), 15000);
            // @ts-ignore
            controller._timer = t;
          },
          cancel() {
            // @ts-ignore
            if (this._timer) clearInterval(this._timer);
          }
        });
        return new Response(stream, { status: 200, headers: { ...defaultHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' } });
      }

      // Streamable HTTP pattern: Claude may open SSE GET on the same /mcp path right after POST
      if (request.method === 'GET' && inUrl.pathname === '/mcp' && accept.includes('text/event-stream')) {
        const hdrIn = new Headers(request.headers);
        const sessionKey = apiKey || hdrIn.get('Authorization') || inUrl.origin;
        let entry = globalState.sessions.get(sessionKey) || {};
        const clientSid = hdrIn.get('Mcp-Session-Id') || hdrIn.get('mcp-session-id');
        if (!entry.sessionId) {
          entry.sessionId = clientSid || await stableSessionIdFromKey(sessionKey);
        }
        globalState.sessions.set(sessionKey, entry);

        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(`: streamable HTTP ready for ${entry.sessionId}\n\n`));
            const t = setInterval(() => controller.enqueue(enc.encode(': keep-alive\n\n')), 15000);
            // @ts-ignore
            controller._timer = t;
          },
          cancel() {
            // @ts-ignore
            if (this._timer) clearInterval(this._timer);
          }
        });

        const sseHeaders = { ...defaultHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'Mcp-Session-Id': entry.sessionId };
        console.log(`📡 SSE /mcp opened (streamable HTTP), session=${entry.sessionId}`);
        return new Response(stream, { status: 200, headers: sseHeaders });
      }

      // Regular HTTP JSON-RPC
      console.log(`🔄 HTTP request: ${request.method} ${request.url}`);
      const hdr = new Headers(request.headers);
      if (apiKey && !hdr.has('Authorization')) hdr.set('Authorization', `Bearer ${apiKey}`);
      // Force JSON to avoid SSE fallback on upstream MCP server
      hdr.set('Accept', 'application/json');
      hdr.set('MCP-Protocol-Version', PROTOCOL_VERSION);

      let bodyText = null;
      let jsonBody = null;
      if (request.method === 'POST') {
        bodyText = await request.text();
        if (!hdr.has('Content-Type')) hdr.set('Content-Type', 'application/json');
        try { jsonBody = JSON.parse(bodyText || '{}'); } catch {}
      }

      // HTTP session bridging and fast-paths for Claude
      if (request.method === 'POST' && jsonBody && typeof jsonBody === 'object' && jsonBody.jsonrpc === '2.0') {
        const method = jsonBody.method;
        const id = jsonBody.id ?? null;

        // Fast-path: return empty structures for prompts/resources to avoid timeouts
        if (method === 'prompts/list') {
          return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { prompts: [] } }), { status: 200, headers: { ...defaultHeaders, 'Content-Type': 'application/json' } });
        }
        if (method === 'resources/list') {
          return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { resources: [] } }), { status: 200, headers: { ...defaultHeaders, 'Content-Type': 'application/json' } });
        }

        // Normalize tools/list at HTTP layer too
        if (method === 'tools/list') {
          try {
            const traceId = `wrk-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            hdr.set('X-Worker-Trace-Id', traceId);
            const backendReq = new Request(cleanUrl.toString(), { method: 'POST', headers: hdr, body: bodyText, redirect: 'manual' });
            console.log(`↗ upstream(HTTP): tools/list POST ${cleanUrl} (Accept=${hdr.get('Accept')}, proto=${hdr.get('MCP-Protocol-Version')}, traceId=${traceId})`);
            const ctrl = new AbortController();
            const TIMEOUT_MS = 15000;
            const timeout = setTimeout(() => ctrl.abort(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
            const r = await fetch(backendReq, { signal: ctrl.signal });
            clearTimeout(timeout);
            const ct = r.headers.get('content-type') || '';
            console.log(`↙ upstream(HTTP): status=${r.status}, content-type="${ct}" (traceId=${traceId})`);
            const data = ct.includes('application/json') ? await r.json() : JSON.parse(await r.text());
            const sanitized = sanitizeToolsPayload(data?.result);
            const sample = (sanitized.tools || []).slice(0, 5).map(t => t?.name).filter(Boolean);
            console.log(`🧰 tools/list(HTTP): sanitized ${sanitized.tools?.length ?? 0} tools; sample=`, sample);
            const resp = { jsonrpc: '2.0', id, result: sanitized };
            return new Response(JSON.stringify(resp), { status: 200, headers: { ...defaultHeaders, 'Content-Type': 'application/json' } });
          } catch (e) {
            console.warn(`⚠️ tools/list(HTTP) proxy failed: ${e?.message || e}`);
            const resp = { jsonrpc: '2.0', id, result: { tools: [] } };
            return new Response(JSON.stringify(resp), { status: 200, headers: { ...defaultHeaders, 'Content-Type': 'application/json' } });
          }
        }

        // Derive a stable session per connector (apiKey or Authorization header)
        const sessionKey = apiKey || hdr.get('Authorization') || inUrl.origin;
        let entry = globalState.sessions.get(sessionKey);
        if (!entry) entry = {};
        if (!entry.sessionId) entry.sessionId = await stableSessionIdFromKey(sessionKey);
        // Use negotiated version if available for subsequent calls
        if (entry.version) hdr.set('MCP-Protocol-Version', entry.version);
        hdr.set('Mcp-Session-Id', entry.sessionId);
        globalState.sessions.set(sessionKey, entry);

        if (method === 'initialize') {
          // Kick off initialize and store promise so followers can wait briefly
          const initReq = new Request(cleanUrl.toString(), { method: 'POST', headers: hdr, body: bodyText, redirect: 'manual' });
          entry.initPromise = (async () => {
            const r = await fetch(initReq);
            // Record negotiated version if present
            try {
              const clone = r.clone();
              const data = await clone.json();
              const v = data?.result?.protocolVersion;
              if (typeof v === 'string' && v.length) entry.version = v;
            } catch {}
            return r;
          })();
          globalState.sessions.set(sessionKey, entry);
          const r = await entry.initPromise;
          const outHdr = new Headers(r.headers);
          Object.entries(defaultHeaders).forEach(([k, v]) => outHdr.set(k, v));
          // Advertise session id so client can open SSE to the same /mcp path
          outHdr.set('Mcp-Session-Id', entry.sessionId);
          return new Response(r.body, { status: r.status, headers: outHdr });
        } else {
          // If initialize is in flight for this session, wait briefly before forwarding
          if (entry.initPromise) {
            try { await Promise.race([entry.initPromise, new Promise((res) => setTimeout(res, 500))]); } catch {}
          }
        }
      }

      // Strip hop-by-hop headers
      ['content-encoding','transfer-encoding','connection','keep-alive','proxy-connection','upgrade'].forEach((h) => hdr.delete(h));

      const traceId = `wrk-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      hdr.set('X-Worker-Trace-Id', traceId);
      const backendReq = new Request(cleanUrl.toString(), { method: request.method, headers: hdr, body: request.method === 'POST' ? bodyText : null, redirect: 'manual' });
      console.log(`↗ upstream(HTTP-generic): ${request.method} ${cleanUrl} (Accept=${hdr.get('Accept')}, proto=${hdr.get('MCP-Protocol-Version')}, traceId=${traceId})`);
      const ctrl = new AbortController();
      const TIMEOUT_MS = 15000;
      const timeout = setTimeout(() => ctrl.abort(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      const upstreamRes = await fetch(backendReq, { signal: ctrl.signal });
      clearTimeout(timeout);
      const ctGeneric = upstreamRes.headers.get('content-type') || '';
      console.log(`↙ upstream(HTTP-generic): status=${upstreamRes.status}, content-type="${ctGeneric}" (traceId=${traceId})`);

      const outHdr = new Headers(upstreamRes.headers);
      Object.entries(defaultHeaders).forEach(([k, v]) => outHdr.set(k, v));
      ['content-encoding','transfer-encoding','connection','keep-alive','proxy-connection','upgrade'].forEach((h) => outHdr.delete(h));

      console.log(`📥 HTTP response: ${upstreamRes.status}`);
      return new Response(upstreamRes.body, { status: upstreamRes.status, headers: outHdr });

    } catch (err) {
      console.error('💥 Worker error:', err);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Internal error', data: String(err?.message || err) } }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'WWW-Authenticate': 'Bearer realm="mcp"', 'MCP-Protocol-Version': '2025-06-18' } });
    }
}
