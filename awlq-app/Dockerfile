# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM oven/bun:canary-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM oven/bun:canary-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client with Alpine (linux-musl) binary target
RUN bunx prisma generate
# Next.js standalone build
RUN bun run build

# ── Stage 3: Minimal production runner ────────────────────────────────────────
FROM oven/bun:canary-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Standalone server (includes traced node_modules)
COPY --from=builder /app/.next/standalone ./
# Static assets and public files must be copied separately
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma generated client + query engine binary
# (the standalone trace does not reliably capture native .so binaries)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "server.js"]
