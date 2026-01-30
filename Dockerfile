# syntax=docker/dockerfile:1.7
# ARM64-compatible Dockerfile with full n8n packages

# Stage 1: Builder (TypeScript compilation only)
FROM --platform=linux/arm64 node:22-alpine AS builder
WORKDIR /app

# Copy tsconfig files for TypeScript compilation
COPY tsconfig*.json ./

# Create minimal package.json and install ONLY build dependencies
# Note: openai and zod are needed for TypeScript compilation of template metadata modules
RUN --mount=type=cache,target=/root/.npm \
    echo '{}' > package.json && \
    npm install --no-save typescript@^5.8.3 @types/node@^22.15.30 @types/express@^5.0.3 \
        @modelcontextprotocol/sdk@^1.12.1 dotenv@^16.5.0 express@^5.1.0 axios@^1.10.0 \
        n8n-workflow@^2.4.2 uuid@^11.0.5 @types/uuid@^10.0.0 \
        openai@^4.77.0 zod@^3.24.1 \
        @supabase/supabase-js@^2.57.4 lru-cache@^11.2.1

# Copy source and build
COPY src ./src
# Note: src/n8n contains TypeScript types needed for compilation
# These will be compiled but not included in runtime
RUN npx tsc -p tsconfig.build.json

# Stage 2: Runtime (full n8n dependencies)
FROM --platform=linux/arm64 node:22-alpine AS runtime
WORKDIR /app

# Install only essential runtime tools
RUN apk add --no-cache curl su-exec && \
    rm -rf /var/cache/apk/*

# Copy full package.json with all n8n dependencies
COPY package.json package-lock.json ./

# Install ALL dependencies including n8n packages
RUN --mount=type=cache,target=/root/.npm \
    npm install --production --no-audit --no-fund

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy pre-built database and required files
# Cache bust: 2025-07-06-trigger-fix-v3 - includes is_trigger=true for webhook,cron,interval,emailReadImap
COPY data/nodes.db ./data/
COPY src/database/schema.sql ./src/database/
COPY src/database/schema-optimized.sql ./src/database/
COPY .env.example ./

# Copy entrypoint script, config parser, and n8n-mcp command
COPY docker/docker-entrypoint.sh /usr/local/bin/
COPY docker/parse-config.js /app/docker/
COPY docker/n8n-mcp /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /usr/local/bin/n8n-mcp

# Add container labels
LABEL org.opencontainers.image.source="https://github.com/czlonkowski/n8n-mcp"
LABEL org.opencontainers.image.description="n8n MCP Server - Full n8n Dependencies"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.title="n8n-mcp"

# Create non-root user with unpredictable UID/GID
# Using a hash of the build time to generate unpredictable IDs
RUN BUILD_HASH=$(date +%s | sha256sum | head -c 8) && \
    UID=$((10000 + 0x${BUILD_HASH} % 50000)) && \
    GID=$((10000 + 0x${BUILD_HASH} % 50000)) && \
    addgroup -g ${GID} -S nodejs && \
    adduser -S nodejs -u ${UID} -G nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set Docker environment flag
ENV IS_DOCKER=true

# Expose HTTP port
EXPOSE 3000

# Set stop signal to SIGTERM (default, but explicit is better)
STOPSIGNAL SIGTERM

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/health || exit 1

# Optimized entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/mcp/index.js"]
