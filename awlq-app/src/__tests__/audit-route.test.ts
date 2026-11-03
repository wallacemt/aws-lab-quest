import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { queryEvents, findTokens, session, user } = vi.hoisted(() => ({
  queryEvents: vi.fn(),
  findTokens: vi.fn(),
  session: vi.fn(),
  user: vi.fn(),
}));

vi.mock("@/features/audit/server/audit-service", () => ({ queryEvents }));
vi.mock("@/lib/prisma", () => ({ prisma: { mcpToken: { findMany: findTokens }, user: { findUnique: user } } }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }));

import { GET } from "@/app/api/admin/audit/route";
import { runInAdminContext } from "@/lib/admin-request-context";

const req = (query = "") => new NextRequest(`http://localhost/api/admin/audit${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ user: { id: "human" } });
  user.mockResolvedValue({ id: "human", email: "h@example.com", role: "admin", active: true });
  queryEvents.mockResolvedValue({ items: [], nextCursor: null });
  findTokens.mockResolvedValue([]);
});

describe("admin audit route", () => {
  it("AC-42: passes all filters, cursor, and capped limit to queryEvents", async () => {
    const response = await GET(req("?cursor=opaque&limit=150&actorType=agent&source=mcp&domain=users&action=approve&tool=users_approve&tokenId=t1&actorUserId=u1&status=error&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-10T00%3A00%3A00.000Z&q=denied"));
    expect(response.status).toBe(200);
    expect(queryEvents).toHaveBeenCalledWith({
      actorType: "agent", source: "mcp", domain: "users", action: "approve", tool: "users_approve",
      tokenId: "t1", actorUserId: "u1", status: "error", from: new Date("2026-10-01T00:00:00.000Z"),
      to: new Date("2026-10-10T00:00:00.000Z"), q: "denied",
    }, "opaque", 100);
  });

  it("AC-43: rejects ranges over 90 days and one-character searches", async () => {
    expect((await GET(req("?from=2026-01-01T00%3A00%3A00.000Z&to=2026-04-02T00%3A00%3A00.000Z"))).status).toBe(400);
    expect((await GET(req("?q=x"))).status).toBe(400);
    expect(queryEvents).not.toHaveBeenCalled();
  });

  it("AC-43: defaults from to seven days ago", async () => {
    const before = Date.now();
    await GET(req());
    const after = Date.now();
    const filters = queryEvents.mock.calls[0][0];
    expect(filters.from.getTime()).toBeGreaterThanOrEqual(before - 7 * 24 * 60 * 60 * 1000);
    expect(filters.from.getTime()).toBeLessThanOrEqual(after - 7 * 24 * 60 * 60 * 1000);
    expect(filters.to).toBeUndefined();
  });

  it("adds tokenName from the matching token and null for human events", async () => {
    queryEvents.mockResolvedValue({ items: [{ id: "a", tokenId: "t1" }, { id: "b", tokenId: null }], nextCursor: "next" });
    findTokens.mockResolvedValue([{ id: "t1", name: "Automation" }]);
    const response = await GET(req());
    expect(await response.json()).toEqual({
      items: [{ id: "a", tokenId: "t1", tokenName: "Automation" }, { id: "b", tokenId: null, tokenName: null }],
      nextCursor: "next",
    });
    expect(findTokens).toHaveBeenCalledWith({ where: { id: { in: ["t1"] } }, select: { id: true, name: true } });
  });

  it("AC-12: forbids MCP principals", async () => {
    const response = await runInAdminContext({ requestId: "r", principal: { userId: "m", email: "m@example.com", scopes: [], tokenId: "t" } }, () => GET(req()));
    expect(response.status).toBe(403);
    expect(queryEvents).not.toHaveBeenCalled();
  });
});
