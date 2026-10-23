import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for real-browser tests (see e2e/*.spec.ts).
 *
 * SAFETY: these tests log in and write real StudySessionHistory/exam rows. Never point
 * them at the production DATABASE_URL. Before running `bun run test:e2e`, run the app
 * against an isolated local Postgres/Redis:
 *
 *   docker run -d --name awlq-e2e-postgres -e POSTGRES_PASSWORD=postgres \
 *     -e POSTGRES_DB=awlq -p 5433:5432 postgres:16-alpine
 *   docker run -d --name awlq-e2e-redis -p 6380:6379 redis:7-alpine
 *
 *   # awlq-app/.env.local
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/awlq"
 *   REDIS_URL="redis://localhost:6380"
 *
 *   npx prisma migrate deploy --schema ../packages/db/prisma/schema.prisma
 *   bun run prisma/seed.ts
 *   bun run prisma/seed-mock-user.ts   # creates mock@awlq.dev / MockUser@123
 *   bun run dev                       # separate terminal, then run the tests
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
