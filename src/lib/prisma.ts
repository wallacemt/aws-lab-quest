import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  const defaultPoolMax = process.env.NODE_ENV === "production" ? 3 : 10;
  const poolMax = parsePositiveInt(process.env.DATABASE_POOL_MAX, defaultPoolMax);
  const idleTimeoutMillis = parsePositiveInt(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS, 30_000);
  const connectionTimeoutMillis = parsePositiveInt(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS, 10_000);

  const pool = new Pool({
    connectionString,
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  });

  // @prisma/adapter-pg bundles its own @types/pg; cast to any to avoid version conflict
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
