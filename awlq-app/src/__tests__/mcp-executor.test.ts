import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeTool } from "@/features/mcp/server/executor";
import { USERS_TOOLS } from "@/features/mcp/server/catalog/users";
const { startPendingEvent, finalizeEvent, recordEvent } = vi.hoisted(() => ({ startPendingEvent: vi.fn(), finalizeEvent: vi.fn(), recordEvent: vi.fn() }));
vi.mock("@/features/audit/server/audit-service", () => ({ startPendingEvent, finalizeEvent, recordEvent }));
vi.mock("@/lib/redis", () => ({ redis: { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) } }));
const principal = { userId: "admin1", email: "a@example.com", scopes: ["users:read", "users:write", "danger"], tokenId: "token1" };
const metadata = { request: new Request("https://app.test/api/mcp", { headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8", "user-agent": "test-agent" } }), ip: "1.2.3.4", userAgent: "test-agent", requestId: "req1" };
beforeEach(() => { vi.clearAllMocks(); process.env.APP_URL = "https://app.test"; startPendingEvent.mockResolvedValue("pending1"); });
describe("MCP executor", () => {
  it("blocks writes when pending audit fails but permits reads", async () => {
    startPendingEvent.mockRejectedValue(new Error("audit down"));
    const writeHandler = vi.fn(async () => new Response("ok"));
    const write = { ...USERS_TOOLS.find(({ name }) => name === "users_approve")!, handler: async () => writeHandler };
    expect((await executeTool(write, { userId: "u1" }, principal, metadata)).isError).toBe(true);
    expect(writeHandler).not.toHaveBeenCalled();
    const readHandler = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    const read = { ...USERS_TOOLS.find(({ name }) => name === "users_get")!, handler: async () => readHandler };
    expect((await executeTool(read, { userId: "u1" }, principal, metadata)).isError).toBe(false);
    expect(readHandler).toHaveBeenCalledOnce();
  });
  it("passes reserved headers and truncates oversized results", async () => {
    const route = vi.fn(async (request: Request) => {
      expect(request.headers.get("X-AWLQ-Actor")).toBe("mcp-agent");
      expect(request.headers.get("X-AWLQ-Mcp-Token-Id")).toBe("token1");
      expect(request.headers.get("X-AWLQ-Request-Id")).toBe("req1");
      expect(request.headers.get("x-real-ip")).toBe("1.2.3.4");
      return new Response(JSON.stringify({ value: "x".repeat(33000) }));
    });
    const tool = { ...USERS_TOOLS.find(({ name }) => name === "users_get")!, handler: async () => route };
    const result = await executeTool(tool, { userId: "u1" }, principal, metadata);
    expect(result.content[0].text).toContain("Resposta truncada");
    expect(result.content[0].text.length).toBeLessThan(32200);
    expect(route).toHaveBeenCalledOnce();
  });
});
