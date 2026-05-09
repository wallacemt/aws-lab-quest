FROM oven/bun:canary-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install 


FROM oven/bun:canary-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts calls env("DATABASE_URL") eagerly even for `generate`,
# which doesn't connect to the DB. Pass a dummy URL to satisfy the check.
ARG DATABASE_URL=postgresql://build:build@localhost/build
ENV DATABASE_URL=$DATABASE_URL
RUN bunx prisma generate
# Next.js standalone build
RUN bun run build


FROM oven/bun:canary-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "server.js"]
