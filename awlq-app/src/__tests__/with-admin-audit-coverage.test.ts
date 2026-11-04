import { describe, expect, it, vi } from "vitest";
import { ADMIN_AUDIT_WRAPPED } from "@/features/audit/server/with-admin-audit";

vi.mock("server-only", () => ({}));

vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
vi.stubEnv("REDIS_URL", "redis://localhost:6379");

const routeModules = import.meta.glob("../app/api/admin/**/route.ts");
const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

describe("admin route audit coverage", () => {
  it("wraps every mutating route export", async () => {
    const failures: string[] = [];
    for (const [path, load] of Object.entries(routeModules)) {
      const routeExports = await load() as Record<string, unknown>;
      for (const method of MUTATING_METHODS) {
        const handler = routeExports[method] as (Record<symbol, unknown> | undefined);
        if (typeof handler === "function" && handler[ADMIN_AUDIT_WRAPPED] !== true) failures.push(`${path}#${method}`);
      }
    }
    expect(failures).toEqual([]);
  }, 120_000);
});
