import { NextRequest, NextResponse } from "next/server";
import { requireHumanAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { queryEvents, type AuditQueryFilters } from "@/features/audit/server/audit-service";

const MAX_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;
const AUDIT_STATUSES = ["pending", "ok", "error", "denied", "rate_limited"] as const;

function parseIsoDate(value: string | null): Date | undefined | null {
  if (value === null) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(value) ? null : date;
}

export async function GET(request: NextRequest) {
  const check = await requireHumanAdmin(request);
  if (!check.ok) return check.response;

  const params = request.nextUrl.searchParams;
  const now = new Date();
  const from = parseIsoDate(params.get("from"));
  const to = parseIsoDate(params.get("to"));
  if (from === null || to === null) {
    return NextResponse.json({ error: "Datas ISO inválidas" }, { status: 400 });
  }
  const start = from ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if ((to ?? now).getTime() - start.getTime() > MAX_INTERVAL_MS) {
    return NextResponse.json({ error: "Intervalo máximo de 90 dias" }, { status: 400 });
  }

  const q = params.get("q") ?? undefined;
  if (q !== undefined && q.length < 2) {
    return NextResponse.json({ error: "Busca deve ter ao menos 2 caracteres" }, { status: 400 });
  }

  const actorType = params.get("actorType") ?? undefined;
  const source = params.get("source") ?? undefined;
  const status = params.get("status") ?? undefined;
  if (actorType !== undefined && actorType !== "human" && actorType !== "agent") {
    return NextResponse.json({ error: "actorType inválido" }, { status: 400 });
  }
  if (source !== undefined && source !== "admin_ui" && source !== "mcp") {
    return NextResponse.json({ error: "source inválido" }, { status: 400 });
  }
  if (status !== undefined && !AUDIT_STATUSES.includes(status as (typeof AUDIT_STATUSES)[number])) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const rawLimit = params.get("limit");
  const parsedLimit = rawLimit === null ? 20 : Number(rawLimit);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 100) : 20;
  const filters: AuditQueryFilters = {
    actorType: actorType as AuditQueryFilters["actorType"],
    source: source as AuditQueryFilters["source"],
    status: status as AuditQueryFilters["status"],
    domain: params.get("domain") ?? undefined,
    action: params.get("action") ?? undefined,
    tool: params.get("tool") ?? undefined,
    tokenId: params.get("tokenId") ?? undefined,
    actorUserId: params.get("actorUserId") ?? undefined,
    from: start,
    to: to ?? undefined,
    q,
  };
  const result = await queryEvents(filters, params.get("cursor") ?? undefined, limit);
  const tokenIds = [...new Set(result.items.map((item) => (item as { tokenId?: string | null }).tokenId).filter((id): id is string => Boolean(id)))];
  const tokens = tokenIds.length
    ? await prisma.mcpToken.findMany({ where: { id: { in: tokenIds } }, select: { id: true, name: true } })
    : [];
  const tokenNames = new Map(tokens.map((token) => [token.id, token.name]));
  const items = result.items.map((item) => {
    const event = item as Record<string, unknown> & { tokenId?: string | null };
    return { ...event, tokenName: event.tokenId ? tokenNames.get(event.tokenId) ?? null : null };
  });
  return NextResponse.json({ items, nextCursor: result.nextCursor });
}
