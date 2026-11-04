import { afterEach, describe, expect, it, vi } from "vitest";

const contextState = vi.hoisted(() => ({ context: undefined as { requestId: string; principal?: unknown; actor?: { userId: string; email: string } } | undefined }));
const recordEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin-request-context", () => ({
  getAdminRequestContext: () => contextState.context,
  runInAdminContext: async (context: typeof contextState.context, fn: () => unknown) => {
    const previous = contextState.context;
    contextState.context = context;
    try { return await fn(); } finally { contextState.context = previous; }
  },
}));
vi.mock("@/features/audit/server/audit-service", () => ({ recordEvent }));

import { ADMIN_AUDIT_WRAPPED, withAdminAudit } from "@/features/audit/server/with-admin-audit";

afterEach(() => { contextState.context = undefined; recordEvent.mockReset(); });

describe("withAdminAudit", () => {
  it("does not duplicate events for MCP principals", async () => {
    contextState.context = { requestId: "mcp-req", principal: { userId: "agent", email: "a@example.com", scopes: [], tokenId: "t" } };
    const handler = withAdminAudit("users/[userId]/approve", async () => new Response(null, { status: 200 }));
    await handler(new Request("https://example.test", { method: "POST" }) as never, { params: Promise.resolve({ userId: "u1" }) } as never);
    expect(recordEvent).not.toHaveBeenCalled();
    expect(handler[ADMIN_AUDIT_WRAPPED]).toBe(true);
  });

  it("records authenticated human mutations with route metadata", async () => {
    const handler = withAdminAudit("users/[userId]/approve", async () => {
      contextState.context!.actor = { userId: "admin-1", email: "admin@example.com" };
      return new Response(null, { status: 200 });
    });
    await handler(new Request("https://example.test", { method: "POST", headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8", "user-agent": "test" } }) as never, { params: Promise.resolve({ userId: "ck123" }) } as never);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorType: "human", source: "admin_ui", actorUserId: "admin-1", actorEmail: "admin@example.com",
      action: "POST users/[userId]/approve", path: "users/ck123/approve", resourceId: "ck123", status: "ok", httpStatus: 200,
      ip: "5.6.7.8", userAgent: "test",
    }));
  });

  it("does not record requests that never authenticate", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = withAdminAudit("users", async () => new Response(null, { status: 401 }));
    await handler(new Request("https://example.test", { method: "POST" }) as never, undefined as never);
    expect(recordEvent).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fails open if recording an event fails", async () => {
    recordEvent.mockRejectedValueOnce(new Error("db down"));
    contextState.context = { requestId: "human-req", actor: { userId: "admin-1", email: "admin@example.com" } };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withAdminAudit("users", async () => new Response(null, { status: 204 }));
    const response = await handler(new Request("https://example.test", { method: "DELETE" }) as never, undefined as never);
    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
