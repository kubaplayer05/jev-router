# syntax=docker/dockerfile:1
# jev-router MCP server - multi-stage build
# Default mode: HTTP/SSE (port 3333). Override CMD for stdio mode.

FROM node:20-slim AS builder
WORKDIR /app

# Enable pnpm (lockfile v9; pnpm 10 reads it and tolerates missing workspace file)
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml tsup.config.ts tsconfig.json ./
COPY src ./src
RUN pnpm install --frozen-lockfile && pnpm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3333 \
    HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@10 --activate \
    && groupadd -r appuser && useradd -r -g appuser appuser

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

COPY --from=builder /app/dist ./dist

USER appuser
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3333/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# HTTP/SSE mode: /sse, /mcp, /health
CMD ["node", "dist/index.js", "--http"]
