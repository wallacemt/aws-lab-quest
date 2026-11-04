import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { McpPrincipal } from "@/lib/admin-request-context";
import { isValidScope, type McpScope } from "@/features/mcp/scopes";

export class TokenLimitExceededError extends Error {
  constructor() { super("Este administrador já possui o limite de 5 tokens ativos."); this.name = "TokenLimitExceededError"; }
}
export class InvalidTokenScopesError extends Error {
  constructor(message = "Informe ao menos um escopo válido.") { super(message); this.name = "InvalidTokenScopesError"; }
}
const hashToken = (secret: string) => createHash("sha256").update(secret).digest("hex");

export async function countActiveTokens(userId: string): Promise<number> {
  return prisma.mcpToken.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } });
}

export async function generateToken(params: { userId: string; name: string; expiresInDays: 1 | 7 | 30 | 90; scopes: McpScope[] }): Promise<{ id: string; secret: string; tokenPrefix: string; expiresAt: Date; name: string; scopes: string[]; createdAt: Date }> {
  if (!Array.isArray(params.scopes) || params.scopes.length === 0 || params.scopes.some((scope) => !isValidScope(scope))) throw new InvalidTokenScopesError();
  if (await countActiveTokens(params.userId) >= 5) throw new TokenLimitExceededError();
  const secret = `awlq_mcp_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000);
  const token = await prisma.mcpToken.create({ data: { userId: params.userId, name: params.name, tokenHash: hashToken(secret), tokenPrefix: secret.slice(0, 16), scopes: params.scopes, expiresAt }, select: { id: true, name: true, scopes: true, createdAt: true } });
  return { id: token.id, secret, tokenPrefix: secret.slice(0, 16), expiresAt, name: token.name, scopes: token.scopes, createdAt: token.createdAt };
}

export async function listTokensForOwner() {
  const tokens = await prisma.mcpToken.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { email: true } } } });
  const now = new Date();
  return tokens.map((token) => ({ id: token.id, name: token.name, tokenPrefix: token.tokenPrefix, scopes: token.scopes, expiresAt: token.expiresAt, revokedAt: token.revokedAt, lastUsedAt: token.lastUsedAt, lastUsedIp: token.lastUsedIp, createdAt: token.createdAt, ownerEmail: token.user.email, status: token.revokedAt ? "revoked" as const : token.expiresAt <= now ? "expired" as const : "active" as const }));
}

export async function revokeToken(tokenId: string, revokedByUserId: string): Promise<{ ok: true; revokedAt: Date }> {
  const token = await prisma.mcpToken.findUnique({ where: { id: tokenId }, select: { revokedAt: true } });
  if (!token) throw new TokenNotFoundError();
  if (token.revokedAt) return { ok: true, revokedAt: token.revokedAt };
  const revokedAt = new Date();
  await prisma.mcpToken.update({ where: { id: tokenId }, data: { revokedAt, revokedByUserId } });
  return { ok: true, revokedAt };
}
export class TokenNotFoundError extends Error {}

export async function verifyBearer(authorizationHeader: string | null): Promise<{ principal: McpPrincipal; expiresAt: Date } | null> {
  const match = authorizationHeader?.match(/^Bearer\s+(awlq_mcp_[A-Za-z0-9_-]+)$/i);
  if (!match) return null;
  const token = await prisma.mcpToken.findUnique({ where: { tokenHash: hashToken(match[1]) }, include: { user: { select: { id: true, email: true, role: true, active: true } } } });
  if (!token || token.revokedAt || token.expiresAt <= new Date() || !token.user.active || token.user.role !== "admin") return null;
  return {
    principal: { userId: token.user.id, email: token.user.email, scopes: token.scopes, tokenId: token.id },
    expiresAt: token.expiresAt,
  };
}

export async function touchLastUsed(tokenId: string, ip: string | null): Promise<void> {
  try { await prisma.mcpToken.update({ where: { id: tokenId }, data: { lastUsedAt: new Date(), lastUsedIp: ip } }); }
  catch (error) { console.error("Failed to update MCP token last-used metadata", error); }
}
