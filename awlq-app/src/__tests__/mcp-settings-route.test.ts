import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { getEnabled, getAllowlist, setEnabled, setAllowlist, session, user } = vi.hoisted(() => ({ getEnabled: vi.fn(), getAllowlist: vi.fn(), setEnabled: vi.fn(), setAllowlist: vi.fn(), session: vi.fn(), user: vi.fn() }));
vi.mock("@/features/mcp/server/settings-service", () => ({ isMcpEnabled: getEnabled, getPdfUrlAllowlist: getAllowlist, setMcpEnabled: setEnabled, setPdfUrlAllowlist: setAllowlist }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } })); vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: user } } }));
import { GET, PATCH } from "@/app/api/admin/mcp/settings/route";
import { runInAdminContext } from "@/lib/admin-request-context";
const req = (method = "GET", body?: unknown) => new NextRequest("http://localhost/api/admin/mcp/settings", { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
beforeEach(() => { vi.clearAllMocks(); process.env.APP_URL = "https://app.example"; session.mockResolvedValue({ user: { id: "human" } }); user.mockResolvedValue({ id: "human", email: "h@e.co", role: "admin", active: true }); getEnabled.mockResolvedValue(true); getAllowlist.mockResolvedValue(["example.com"]); });
describe("MCP settings route", () => {
  it("AC-12: forbids MCP principals", async () => { const r = await runInAdminContext({ requestId: "r", principal: { userId: "m", email: "m@e.co", scopes: [], tokenId: "t" } }, () => GET(req())); expect(r.status).toBe(403); });
  it("returns current settings and endpoint", async () => { expect(await (await GET(req())).json()).toEqual({ enabled: true, endpointUrl: "https://app.example/api/mcp", pdfUrlAllowlist: ["example.com"] }); });
  it("AC-23: translates allowlist validation errors into 400", async () => { setAllowlist.mockRejectedValue(new Error("Hostname inválido")); const r = await PATCH(req("PATCH", { pdfUrlAllowlist: ["http://example.com/path"] })); expect(r.status).toBe(400); expect(await r.json()).toEqual({ error: "Hostname inválido" }); });
});
