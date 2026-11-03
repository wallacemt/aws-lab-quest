import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetSession, mockFindUnique } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mockGetSession } } }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mockFindUnique } } }));

import { requireAdmin, requireHumanAdmin } from "@/lib/admin-auth";
import { runInAdminContext } from "@/lib/admin-request-context";

const principal = {
  userId: "admin-1",
  email: "admin@example.com",
  scopes: ["admin:*"],
  tokenId: "token-1",
};

function request(headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/admin/example", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin request authentication", () => {
  it("AC-04: returns 401 for a normal request without a session", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await requireAdmin(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(mockGetSession).toHaveBeenCalledOnce();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("AC-05: accepts the MCP principal after DB validation without reading a session", async () => {
    mockFindUnique.mockResolvedValue({ id: "admin-1", email: "admin@example.com", role: "admin", active: true });

    const result = await runInAdminContext(
      { requestId: "request-1", principal },
      () => requireAdmin(request()),
    );

    expect(result).toEqual({ ok: true, userId: "admin-1", email: "admin@example.com", role: "admin" });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      select: { id: true, email: true, role: true, active: true },
    });
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("AC-06: denies MCP callers through requireHumanAdmin and uses session auth without a principal", async () => {
    const mcpResult = await runInAdminContext(
      { requestId: "request-1", principal },
      () => requireHumanAdmin(request()),
    );
    expect(mcpResult.ok).toBe(false);
    if (!mcpResult.ok) expect(mcpResult.response.status).toBe(403);
    expect(mockGetSession).not.toHaveBeenCalled();

    mockGetSession.mockResolvedValue({ user: { id: "human-1" } });
    mockFindUnique.mockResolvedValue({ id: "human-1", email: "human@example.com", role: "admin", active: true });
    const humanResult = await requireHumanAdmin(request());
    expect(humanResult).toEqual({ ok: true, userId: "human-1", email: "human@example.com", role: "admin" });
  });

  it.each(["X-AWLQ-Actor", "X-AWLQ-Mcp-Token-Id", "X-AWLQ-Request-Id"])(
    "AC-31: rejects external reserved header %s even with a valid admin session",
    async (header) => {
      mockGetSession.mockResolvedValue({ user: { id: "admin-1" } });

      const result = await requireAdmin(request({ [header]: "forged" }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        await expect(result.response.json()).resolves.toEqual({ error: "Cabecalho reservado" });
      }
      expect(mockGetSession).not.toHaveBeenCalled();
      expect(mockFindUnique).not.toHaveBeenCalled();
    },
  );
});
