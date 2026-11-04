import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPdfUrlAllowlist } = vi.hoisted(() => ({ getPdfUrlAllowlist: vi.fn<() => Promise<string[]>>() }));
vi.mock("@/features/mcp/server/settings-service", () => ({ getPdfUrlAllowlist }));

import { ADMIN_TOOL_CATALOG } from "@/features/mcp/server/catalog";
import { INGESTION_TOOLS } from "@/features/mcp/server/catalog/ingestion";
import { QUESTIONS_TOOLS } from "@/features/mcp/server/catalog/questions";

describe("MCP questions and ingestion catalogs", () => {
  beforeEach(() => getPdfUrlAllowlist.mockReset());

  it("has unique names and excludes forbidden route paths", () => {
    const names = ADMIN_TOOL_CATALOG.map(({ name }) => name);
    expect(names.length).toBe(new Set(names).size);
    expect(ADMIN_TOOL_CATALOG.map(({ path }) => path)).not.toContain("uploads/[fileId]/signed-url");
    expect(ADMIN_TOOL_CATALOG.map(({ path }) => path)).not.toContain("pdf/extract");
    expect(ADMIN_TOOL_CATALOG.map(({ path }) => path)).not.toContain("pdf/ingest");
    expect(ADMIN_TOOL_CATALOG.map(({ method, path }) => `${method} ${path}`)).not.toContain("POST pdf/exam-guide");
  });

  it("rejects fields outside strict question update and batch schemas", () => {
    const update = QUESTIONS_TOOLS.find(({ name }) => name === "questions_update")!;
    const batch = QUESTIONS_TOOLS.find(({ name }) => name === "questions_batch_update")!;
    expect(update.inputSchema.safeParse({ questionId: "q1", unrecognized: true }).success).toBe(false);
    expect(batch.inputSchema.safeParse({ action: "set-active", ids: ["q1"], active: true, unrecognized: true }).success).toBe(false);
  });

  it("denies source hosts outside the allowlist and allows exact or subdomain matches", async () => {
    const source = INGESTION_TOOLS.find(({ name }) => name === "ingestion_source_create")!;
    const preflight = source.preflight!;
    getPdfUrlAllowlist.mockResolvedValueOnce(["trusted.example"]);
    await expect(preflight({ displayName: "Feed", url: "https://evil.example/feed" } as never)).resolves.toBe("Host fora da allowlist de ingestão por URL.");
    getPdfUrlAllowlist.mockResolvedValueOnce(["trusted.example"]);
    await expect(preflight({ displayName: "Feed", url: "https://sub.trusted.example/feed" } as never)).resolves.toBeNull();
    getPdfUrlAllowlist.mockResolvedValueOnce([]);
    await expect(preflight({ displayName: "Feed", url: "https://trusted.example/feed" } as never)).resolves.toBe("Host fora da allowlist de ingestão por URL.");
  });

  it("resolves lazy route handlers for representative tools", async () => {
    // These dynamic imports pull in real singletons (prisma, supabase, redis)
    // that throw at module load time without their env vars — set dummy
    // values since we only check that the handler resolves to a function,
    // never execute a real query/request.
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.SUPABASE_URL ??= "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    for (const name of ["questions_list", "questions_batch_update", "questions_batch_delete"]) {
      expect(typeof (await QUESTIONS_TOOLS.find((tool) => tool.name === name)!.handler())).toBe("function");
    }
    for (const name of ["uploads_list", "ingestion_source_create", "exam_guide_status"]) {
      expect(typeof (await INGESTION_TOOLS.find((tool) => tool.name === name)!.handler())).toBe("function");
    }
  }, 90000);

  it("fixes batch actions in the generated bodies", () => {
    const update = QUESTIONS_TOOLS.find(({ name }) => name === "questions_batch_update")!;
    const remove = QUESTIONS_TOOLS.find(({ name }) => name === "questions_batch_delete")!;
    expect(update.buildBody?.({ action: "set-active", ids: ["q1"], active: false } as never)).toEqual({ action: "set-active", ids: ["q1"], active: false });
    expect(remove.buildBody?.({ ids: ["q1"] } as never)).toEqual({ action: "delete", ids: ["q1"] });
  });
});
