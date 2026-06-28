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
WORKDIR /app
RUN bun packages/db/node_modules/prisma/build/index.js generate \
    --schema=packages/db/prisma/schema.prisma

# Replace the @prisma/client stub with the generated client.
RUN rm -rf awlq-worker/node_modules/@prisma/client && \
    cp -r packages/db/generated/client awlq-worker/node_modules/@prisma/client

# Bundle everything into a single self-contained file.
# @prisma/client is externalized because it contains WASM and generated
# types that must be loaded at runtime, not inlined.
# bun's bundler resolves all workspace symlinks automatically.
WORKDIR /app/awlq-worker
RUN bun build src/index.ts \
    --outfile dist/index.js \
    --target bun \
    --bundle \
    --external @prisma/client \
    --define 'process.env.NODE_ENV="production"'

FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Bundle is one file; only @prisma/client must live in node_modules.
COPY --from=builder /app/awlq-worker/dist/index.js ./dist/index.js
COPY --from=builder /app/awlq-worker/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/packages/db/node_modules/@prisma/client-runtime-utils ./node_modules/@prisma/client-runtime-utils

CMD ["bun", "dist/index.js"]
