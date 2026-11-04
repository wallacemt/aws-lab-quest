import { createMcpHandler } from "@modelcontextprotocol/server";
import { NextResponse, type NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { isMcpEnabled } from "@/features/mcp/server/settings-service";
import { touchLastUsed, verifyBearer } from "@/features/mcp/server/token-service";
import { buildServer } from "@/features/mcp/server/build-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = createMcpHandler((ctx) => buildServer(ctx));

function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() ?? "";
}

async function incrementWindow(key: string, limit: number): Promise<boolean> {
  if (!redis) throw new Error("Redis indisponível");
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count > limit;
}

async function route(request: NextRequest) {
  if (request.headers.has("origin")) return NextResponse.json({ error: "Origin nao permitida" }, { status: 403 });
  if (!await isMcpEnabled()) return new Response(null, { status: 404 });
  const ip = clientIp(request);
  const redisClient = redis;
  if (!redisClient) return new Response(null, { status: 503 });
  try {
    const failures = Number(await redisClient.get(`mcp-auth-fail:${ip}`) ?? 0);
    if (failures >= 20) return new Response(null, { status: 429 });
  } catch (error) {
    console.error("MCP auth rate limit unavailable", error);
    return new Response(null, { status: 503 });
  }
  const verified = await verifyBearer(request.headers.get("authorization"));
  if (!verified) {
  try { await incrementWindow(`mcp-auth-fail:${ip}`, 20); } catch (error) { console.error("MCP auth rate limit failed", error); }
    console.warn("Invalid MCP bearer token", { ip });
    return new Response(null, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="awlq-mcp"' } });
  }
  const { principal, expiresAt } = verified;
  try {
    if (await incrementWindow(`mcp:${principal.tokenId}`, 120)) return new Response(null, { status: 429 });
  } catch (error) {
    console.error("MCP token rate limit unavailable", error);
    return new Response(null, { status: 503 });
  }
  void Promise.resolve(touchLastUsed(principal.tokenId, ip || null)).catch((error) => console.error("MCP token touch failed", error));
  const authInfo = {
    token: "[redacted]",
    clientId: principal.tokenId,
    scopes: principal.scopes,
    expiresAt: Math.floor(expiresAt.getTime() / 1000),
    extra: { principal, ip },
  };
  return handler.fetch(request, { authInfo });
}

export const POST = route;
export const GET = route;
export const DELETE = route;
