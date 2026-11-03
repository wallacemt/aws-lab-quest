import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { count, create, findMany, findUnique, update, session, user } = vi.hoisted(() => ({ count: vi.fn(), create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), session: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { mcpToken: { count, create, findMany, findUnique, update }, user: { findUnique: user } } }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }));
import { GET, POST } from "@/app/api/admin/mcp/tokens/route";
import { DELETE } from "@/app/api/admin/mcp/tokens/[tokenId]/route";
import { runInAdminContext } from "@/lib/admin-request-context";
const req = (url: string, method = "GET", body?: unknown) => new NextRequest(url, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
const principal = { userId: "mcp", email: "m@e.co", scopes: [], tokenId: "t" };
beforeEach(() => { vi.clearAllMocks(); session.mockResolvedValue({ user: { id: "human" } }); user.mockResolvedValue({ id: "human", email: "h@e.co", role: "admin", active: true }); count.mockResolvedValue(0); create.mockImplementation(async ({ data }) => ({ id: "t1", name: data.name, scopes: data.scopes, createdAt: new Date() })); });
describe("MCP token routes", () => {
  it("AC-12: forbids MCP principals on GET, POST and DELETE", async () => {
    const results = await runInAdminContext({ requestId: "r", principal }, async () => Promise.all([GET(req("http://localhost/api/admin/mcp/tokens")), POST(req("http://localhost/api/admin/mcp/tokens", "POST", { name: "n", expiresInDays: 1, scopes: ["users:read"] })), DELETE(req("http://localhost/api/admin/mcp/tokens/t1"), { params: Promise.resolve({ tokenId: "t1" }) })]));
    expect(results.map((r) => r.status)).toEqual([403, 403, 403]);
  });
  it("AC-07: returns secret only on create and never in list", async () => {
    const created = await POST(req("http://localhost/api/admin/mcp/tokens", "POST", { name: "CLI", expiresInDays: 7, scopes: ["users:read"] }));
    expect(created.status).toBe(201); const payload = await created.json(); expect(payload.secret).toMatch(/^awlq_mcp_/); expect(payload.token).not.toHaveProperty("secret");
    findMany.mockResolvedValue([{ id: "t1", name: "CLI", tokenPrefix: "awlq_mcp_1234567", scopes: [], expiresAt: new Date(), revokedAt: null, lastUsedAt: null, lastUsedIp: null, createdAt: new Date(), user: { email: "h@e.co" } }]);
    const listed = await GET(req("http://localhost/api/admin/mcp/tokens")); expect(JSON.stringify(await listed.json())).not.toContain(payload.secret);
  });
  it("AC-08: rejects unsupported expiry, empty scopes and invalid scope", async () => {
    for (const value of [{ name: "a", expiresInDays: 2, scopes: ["users:read"] }, { name: "a", expiresInDays: 1, scopes: [] }, { name: "a", expiresInDays: 1, scopes: ["bad"] }]) expect((await POST(req("http://localhost/api/admin/mcp/tokens", "POST", value))).status).toBe(400);
  });
  it("AC-09: maps the sixth active token to 409", async () => { count.mockResolvedValue(5); const r = await POST(req("http://localhost/api/admin/mcp/tokens", "POST", { name: "a", expiresInDays: 1, scopes: ["users:read"] })); expect(r.status).toBe(409); });
  it("AC-10: returns 404 for missing token and 200 for repeated deletion", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ revokedAt: null }).mockResolvedValueOnce({ revokedAt: new Date("2026-01-01") }); update.mockResolvedValue({});
    const url = "http://localhost/api/admin/mcp/tokens/t1"; expect((await DELETE(req(url, "DELETE"), { params: Promise.resolve({ tokenId: "t1" }) })).status).toBe(404);
    expect((await DELETE(req(url, "DELETE"), { params: Promise.resolve({ tokenId: "t1" }) })).status).toBe(200);
    expect((await DELETE(req(url, "DELETE"), { params: Promise.resolve({ tokenId: "t1" }) })).status).toBe(200);
  });
});
