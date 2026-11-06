import { beforeEach, describe, expect, it, vi } from "vitest";
const { verifyBearer, touchLastUsed, isMcpEnabled, fetchHandler, incr, expire, get } = vi.hoisted(() => ({ verifyBearer: vi.fn(), touchLastUsed: vi.fn(), isMcpEnabled: vi.fn(), fetchHandler: vi.fn(), incr: vi.fn(), expire: vi.fn(), get: vi.fn() }));
vi.mock("@/features/mcp/server/token-service", () => ({ verifyBearer, touchLastUsed }));
vi.mock("@/features/mcp/server/settings-service", () => ({ isMcpEnabled }));
vi.mock("@/features/mcp/server/build-server", () => ({ buildServer: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redis: { incr, expire, get } }));
vi.mock("@modelcontextprotocol/server", () => ({ createMcpHandler: () => ({ fetch: fetchHandler }) }));
import { POST } from "@/app/api/mcp/route";
const makeRequest = (headers: HeadersInit = {}) => new Request("https://app.test/api/mcp", { method: "POST", headers, body: "{}" });
beforeEach(() => { vi.clearAllMocks(); isMcpEnabled.mockResolvedValue(true); incr.mockResolvedValue(1); expire.mockResolvedValue(1); get.mockResolvedValue("0"); verifyBearer.mockResolvedValue(null); touchLastUsed.mockResolvedValue(undefined); });
describe("MCP endpoint pipeline", () => {
  it("rejects Origin before flag and auth", async () => { const response = await POST(makeRequest({ origin: "https://evil.test" }) as never); expect(response.status).toBe(403); expect(isMcpEnabled).not.toHaveBeenCalled(); });
  it("returns 404 when disabled", async () => { isMcpEnabled.mockResolvedValue(false); const response = await POST(makeRequest() as never); expect(response.status).toBe(404); expect(verifyBearer).not.toHaveBeenCalled(); });
  it("returns bearer challenge without audit for invalid credentials", async () => { const response = await POST(makeRequest() as never); expect(response.status).toBe(401); expect(response.headers.get("www-authenticate")).toBe('Bearer realm="awlq-mcp"'); expect(incr).toHaveBeenCalledWith("mcp-auth-fail:"); });
  it("returns 429 at the IP failure limit", async () => { get.mockResolvedValue("20"); const response = await POST(makeRequest({ "x-real-ip": "1.2.3.4" }) as never); expect(response.status).toBe(429); expect(verifyBearer).not.toHaveBeenCalled(); });
  it("passes verified expiration and principal to the SDK", async () => {
    const principal = { userId: "u1", email: "a@b.test", scopes: ["metrics:read"], tokenId: "t1" };
    verifyBearer.mockResolvedValue({ principal, expiresAt: new Date("2030-01-01T00:00:00Z") }); fetchHandler.mockResolvedValue(new Response("ok"));
    const req = makeRequest({ authorization: "Bearer valid", "x-real-ip": "1.2.3.4" }); await POST(req as never);
    expect(fetchHandler).toHaveBeenCalledWith(req, expect.objectContaining({ authInfo: expect.objectContaining({ expiresAt: 1893456000, extra: { principal, ip: "1.2.3.4" } }) })); expect(touchLastUsed).toHaveBeenCalledWith("t1", "1.2.3.4");
  });
});
