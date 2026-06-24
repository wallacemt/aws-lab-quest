# Build context: aws-lab-quest/ (monorepo root)
FROM oven/bun:1-alpine AS deps
WORKDIR /app
# Install app dependencies using workspace root
COPY package.json ./
COPY awlq-app/package.json awlq-app/bun.lock ./awlq-app/
COPY packages/db/package.json ./packages/db/
RUN cd awlq-app && bun install --frozen-lockfile


FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/awlq-app/node_modules ./awlq-app/node_modules
# Copy shared Prisma schema (source of truth)
COPY packages/db/prisma/ ./packages/db/prisma/
# Copy app source
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

RUN cd awlq-app && bunx prisma generate --schema=../packages/db/prisma/schema.prisma
RUN cd awlq-app && bun run build


FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder /app/awlq-app/.next/standalone ./
COPY --from=builder /app/awlq-app/.next/static ./.next/static
COPY --from=builder /app/awlq-app/public ./public

COPY --from=builder /app/awlq-app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/awlq-app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "server.js"]
