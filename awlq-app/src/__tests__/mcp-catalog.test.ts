import { describe, expect, it } from "vitest";
import { getToolsForScopes } from "@/features/mcp/server/catalog";
import { USERS_TOOLS } from "@/features/mcp/server/catalog/users";
import { METRICS_TOOLS } from "@/features/mcp/server/catalog/metrics";

describe("MCP pilot catalog", () => {
  it("exposes exactly four metrics tools to metrics:read", () => {
    expect(getToolsForScopes(["metrics:read"]).map((tool) => tool.name)).toEqual(["metrics_overview", "metrics_engagement", "metrics_questions", "metrics_users"]);
  });
  it("requires write and danger to expose users_delete", () => {
    expect(getToolsForScopes(["users:write"]).some((tool) => tool.name === "users_delete")).toBe(false);
    expect(getToolsForScopes(["users:write", "danger"]).some((tool) => tool.name === "users_delete")).toBe(true);
  });
  it("strictly rejects role on users_update", () => {
    const tool = USERS_TOOLS.find(({ name }) => name === "users_update")!;
    expect(tool.inputSchema.safeParse({ userId: "u1", role: "admin" }).success).toBe(false);
  });
  it("defines one lazy route handler per pilot tool", () => {
    for (const tool of [...USERS_TOOLS, ...METRICS_TOOLS]) expect(typeof tool.handler).toBe("function");
  });
});
