FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma/ ./prisma/
RUN bun install --frozen-lockfile

RUN bunx prisma generate

COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

CMD ["bun", "dist/index.js"]
