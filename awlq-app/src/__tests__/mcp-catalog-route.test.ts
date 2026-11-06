import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { session, user } = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } })); vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: user } } }));
import { GET } from "@/app/api/admin/mcp/catalog/route";
import { MCP_SCOPES } from "@/features/mcp/scopes";
import { runInAdminContext } from "@/lib/admin-request-context";
const req = () => new NextRequest("http://localhost/api/admin/mcp/catalog");
beforeEach(() => { vi.clearAllMocks(); session.mockResolvedValue({ user: { id: "human" } }); user.mockResolvedValue({ id: "human", email: "h@e.co", role: "admin", active: true }); });
describe("MCP catalog route", () => {
  it("AC-12: forbids MCP principals", async () => { const r = await runInAdminContext({ requestId: "r", principal: { userId: "m", email: "m@e.co", scopes: [], tokenId: "t" } }, () => GET(req())); expect(r.status).toBe(403); });
  it("lists all 18 scopes and no tools yet", async () => { expect(MCP_SCOPES).toHaveLength(18); const r = await GET(req()); expect(await r.json()).toEqual({ scopes: MCP_SCOPES, tools: [] }); });
});
