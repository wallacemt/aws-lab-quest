FROM oven/bun:canary-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma/ ./prisma/
RUN bun ci

RUN bunx prisma generate

COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM oven/bun:canary-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

CMD ["bun", "dist/index.js"]
