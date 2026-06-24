# Build context: aws-lab-quest/ (monorepo root)
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY awlq-worker/package.json awlq-worker/bun.lock ./awlq-worker/
COPY packages/db/package.json ./packages/db/
RUN cd awlq-worker && bun install --frozen-lockfile

# Copy shared Prisma schema (source of truth)
COPY packages/db/prisma/schema.prisma ./packages/db/prisma/schema.prisma

RUN cd awlq-worker && bunx prisma generate --schema=../packages/db/prisma/schema.prisma

COPY awlq-worker/tsconfig.json ./awlq-worker/
COPY awlq-worker/src/ ./awlq-worker/src/
RUN cd awlq-worker && bun run build

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/awlq-worker/dist ./dist
COPY --from=builder /app/awlq-worker/node_modules ./node_modules
COPY --from=builder /app/awlq-worker/package.json ./package.json

CMD ["bun", "dist/index.js"]
