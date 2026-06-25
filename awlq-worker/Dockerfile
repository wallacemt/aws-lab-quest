# Build context: aws-lab-quest/ (monorepo root)
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY awlq-worker/package.json awlq-worker/bun.lock ./awlq-worker/
COPY awlq-worker/prisma.config.ts ./awlq-worker/
COPY packages/db/package.json ./packages/db/
RUN cd awlq-worker && bun install --frozen-lockfile

# Copy shared Prisma schema (source of truth)
COPY packages/db/prisma/schema.prisma ./packages/db/prisma/schema.prisma

ARG DATABASE_URL=postgresql://build:build@localhost/build
ENV DATABASE_URL=$DATABASE_URL

RUN cd awlq-worker && bunx prisma generate

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
