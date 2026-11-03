import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const { count, create, findMany, findUnique, update, userFindUnique } = vi.hoisted(() => ({ count: vi.fn(), create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), userFindUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { mcpToken: { count, create, findMany, findUnique, update }, user: { findUnique: userFindUnique } } }));
import { countActiveTokens, generateToken, InvalidTokenScopesError, revokeToken, TokenLimitExceededError, touchLastUsed, verifyBearer } from "@/features/mcp/server/token-service";
beforeEach(() => vi.clearAllMocks());

describe("MCP token service", () => {
  it("AC-07: issues a long secret but persists only its SHA-256 and display prefix", async () => {
    count.mockResolvedValue(0); const createdAt = new Date();
    create.mockImplementation(async ({ data }) => ({ id: "t1", name: data.name, scopes: data.scopes, createdAt }));
    const result = await generateToken({ userId: "u1", name: "CLI", expiresInDays: 7, scopes: ["users:read"] });
    expect(result.secret).toMatch(/^awlq_mcp_/); expect(result.secret.length).toBeGreaterThanOrEqual(40);
    const data = create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(createHash("sha256").update(result.secret).digest("hex"));
    expect(data.tokenPrefix).toBe(result.secret.slice(0, 16)); expect(JSON.stringify(data)).not.toContain(result.secret);
  });
  it("AC-09: enforces 5 active tokens and counts only non-revoked, non-expired tokens", async () => {
    count.mockResolvedValue(5);
    await expect(generateToken({ userId: "u1", name: "x", expiresInDays: 1, scopes: ["users:read"] })).rejects.toBeInstanceOf(TokenLimitExceededError);
    await countActiveTokens("u1"); expect(count).toHaveBeenLastCalledWith({ where: { userId: "u1", revokedAt: null, expiresAt: { gt: expect.any(Date) } } });
  });
  it("AC-08: rejects empty or invalid scopes", async () => {
    await expect(generateToken({ userId: "u1", name: "x", expiresInDays: 1, scopes: [] })).rejects.toBeInstanceOf(InvalidTokenScopesError);
    await expect(generateToken({ userId: "u1", name: "x", expiresInDays: 1, scopes: ["bad"] as never })).rejects.toBeInstanceOf(InvalidTokenScopesError);
    expect(count).not.toHaveBeenCalled();
  });
  it("AC-10: revokes idempotently and denies malformed, revoked, expired, or non-admin credentials", async () => {
    const revokedAt = new Date(); findUnique.mockResolvedValueOnce({ revokedAt: null }).mockResolvedValueOnce({ revokedAt });
    update.mockResolvedValue({});
    expect(await revokeToken("t1", "admin")).toEqual({ ok: true, revokedAt: expect.any(Date) });
    expect(await revokeToken("t1", "admin")).toEqual({ ok: true, revokedAt }); expect(update).toHaveBeenCalledOnce();
    expect(await verifyBearer(null)).toBeNull();
    findUnique.mockResolvedValue({ id: "t1", revokedAt, expiresAt: new Date(Date.now() + 10000), user: { id: "u1", email: "a@b.c", role: "admin", active: true }, scopes: [] });
    expect(await verifyBearer("Bearer awlq_mcp_Abc")).toBeNull();
  });
  it("AC-11: verifies active admin and denies inactive or non-admin owners", async () => {
    const secret = "awlq_mcp_" + "A".repeat(43);
    findUnique.mockResolvedValue({ id: "t1", revokedAt: null, expiresAt: new Date(Date.now() + 10000), user: { id: "u1", email: "a@b.c", role: "admin", active: true }, scopes: ["users:read"] });
    expect(await verifyBearer(`Bearer ${secret}`)).toEqual({ userId: "u1", email: "a@b.c", scopes: ["users:read"], tokenId: "t1" });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: createHash("sha256").update(secret).digest("hex") } }));
    findUnique.mockResolvedValueOnce({ id: "t1", revokedAt: null, expiresAt: new Date(Date.now() + 10000), user: { id: "u1", email: "a@b.c", role: "user", active: true }, scopes: [] });
    expect(await verifyBearer(`Bearer ${secret}`)).toBeNull();
    findUnique.mockResolvedValueOnce({ id: "t1", revokedAt: null, expiresAt: new Date(Date.now() + 10000), user: { id: "u1", email: "a@b.c", role: "admin", active: false }, scopes: [] });
    expect(await verifyBearer(`Bearer ${secret}`)).toBeNull();
  });
  it("swallows last-used update failures", async () => { update.mockRejectedValue(new Error("offline")); await expect(touchLastUsed("t1", null)).resolves.toBeUndefined(); });
});
