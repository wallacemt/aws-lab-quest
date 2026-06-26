# Build context: aws-lab-quest/ (monorepo root)
FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY packages/db/package.json ./packages/db/
COPY awlq-app/package.json ./awlq-app/
COPY awlq-worker/package.json ./awlq-worker/

# Root workspace install: installs all workspace members' deps.
# With bun workspaces, each member's node_modules/ entries are symlinks into
# node_modules/.bun/ (the content-addressable store at the monorepo root).
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Root node_modules carries the .bun/ content store that all workspace symlinks
# (awlq-app/node_modules/next, packages/db/node_modules/prisma, etc.) point into.
# Without it, every workspace symlink is broken.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/awlq-app/node_modules ./awlq-app/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

COPY packages/db/ ./packages/db/
COPY awlq-app/ ./awlq-app/

# Modules loaded during `next build` pre-rendering validate these vars at
# import time. Dummy values satisfy the checks; real values come from
# docker-compose at runtime and are never baked into the image.
ARG DATABASE_URL=postgresql://build:build@localhost/build
ARG BETTER_AUTH_SECRET=build-time-placeholder-minimum-32-chars-x
ARG BETTER_AUTH_URL=http://localhost:3000
ARG SUPABASE_URL=https://placeholder.supabase.co
ARG SUPABASE_SERVICE_ROLE_KEY=build-time-placeholder-supabase-service-key
ENV DATABASE_URL=$DATABASE_URL \
    BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET \
    BETTER_AUTH_URL=$BETTER_AUTH_URL \
    SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Turbopack detects /app/ as the monorepo workspace root (highest node_modules/ dir)
# and requires next/package.json to exist there. The bun store has it; expose it.
RUN ln -sf "$(readlink -f awlq-app/node_modules/next)" node_modules/next

WORKDIR /app
RUN bun packages/db/node_modules/prisma/build/index.js generate \
    --schema=packages/db/prisma/schema.prisma

# Replace the @prisma/client stub with the generated client.
# Also expose @prisma/client-runtime-utils which the generated client's runtime
# requires but is missing from awlq-app/node_modules/@prisma/ (only in packages/db).
RUN rm -rf awlq-app/node_modules/@prisma/client && \
    cp -rL packages/db/generated/client awlq-app/node_modules/@prisma/client && \
    ln -sf "$(readlink -f packages/db/node_modules/@prisma/client-runtime-utils)" \
        awlq-app/node_modules/@prisma/client-runtime-utils

WORKDIR /app/awlq-app
RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder /app/awlq-app/.next/standalone ./
COPY --from=builder /app/awlq-app/.next/static ./.next/static
COPY --from=builder /app/awlq-app/public ./public

# The standalone's bundled @prisma/client is a pre-generate stub.
# Overwrite with the generated client (model types + WASM runtime, self-contained).
COPY --from=builder /app/awlq-app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "server.js"]
