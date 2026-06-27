# Build context: aws-lab-quest/ (monorepo root)
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# All workspace manifests so bun resolves packages/db as a workspace member
# and installs @prisma/client into packages/db/node_modules (needed for prisma generate)
COPY package.json bun.lock bunfig.toml ./
COPY packages/db/package.json ./packages/db/
COPY awlq-app/package.json ./awlq-app/
COPY awlq-worker/package.json ./awlq-worker/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/awlq-worker/node_modules ./awlq-worker/node_modules

COPY packages/db/ ./packages/db/
COPY awlq-worker/ ./awlq-worker/

ARG DATABASE_URL=postgresql://build:build@localhost/build
ENV DATABASE_URL=$DATABASE_URL

# Generate from packages/db where @prisma/client is installed as a direct dep.
# bunx works regardless of how bun creates bin wrappers (.bunx/.exe on WSL2).
WORKDIR /app
RUN bun packages/db/node_modules/prisma/build/index.js generate \
    --schema=packages/db/prisma/schema.prisma

# Replace the @prisma/client stub with the generated client.
# The generated package has index.d.ts (model types), index.js (WASM runtime),
# and package.json with exports — no .prisma/client/ indirection needed.
RUN rm -rf awlq-worker/node_modules/@prisma/client && \
    cp -r packages/db/generated/client awlq-worker/node_modules/@prisma/client

RUN cd awlq-worker && bun run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/awlq-worker/dist ./dist
COPY --from=builder /app/awlq-worker/package.json ./package.json
# Root node_modules has all hoisted bun workspace packages (dotenv, bullmq, etc.)
COPY --from=builder /app/node_modules ./node_modules
# Generated Prisma client overwrites the stub
COPY --from=builder /app/awlq-worker/node_modules/@prisma/client ./node_modules/@prisma/client

CMD ["node", "dist/index.js"]
