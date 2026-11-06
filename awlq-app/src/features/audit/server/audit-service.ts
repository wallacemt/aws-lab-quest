import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maskPersonalData } from "@/features/mcp/server/pii-mask";

export type RecordEventInput = {
  requestId: string;
  actorType: "human" | "agent";
  source: "admin_ui" | "mcp";
  actorUserId: string;
  actorEmail: string;
  tokenId?: string;
  tool?: string;
  domain: string;
  action: string;
  path: string;
  resourceId?: string;
  status: "ok" | "error" | "denied" | "rate_limited";
  httpStatus?: number;
  durationMs?: number;
  argsRedacted?: unknown;
  errorMessage?: string;
  ip?: string;
  userAgent?: string;
};

type PendingEventInput = Omit<RecordEventInput, "status" | "httpStatus" | "durationMs" | "errorMessage">;
type FinalEventUpdate = Pick<RecordEventInput, "status"> & Pick<RecordEventInput, "httpStatus" | "durationMs" | "errorMessage">;

export type AuditQueryFilters = {
  actorType?: "human" | "agent";
  source?: "admin_ui" | "mcp";
  domain?: string;
  action?: string;
  tool?: string;
  tokenId?: string;
  actorUserId?: string;
  status?: "pending" | "ok" | "error" | "denied" | "rate_limited";
  from?: Date;
  to?: Date;
  q?: string;
};

const MAX_ARGS_BYTES = 4096;
const MAX_STRING_LENGTH = 500;
const SENSITIVE_KEY = /pass|secret|token|key|html/i;
const SEARCH_FIELDS = ["action", "path", "tool", "resourceId", "actorEmail", "errorMessage"] as const;

function cleanAndTruncate(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncado]` : value;
  }
  if (Array.isArray(value)) return value.map(cleanAndTruncate);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (!SENSITIVE_KEY.test(key)) result[key] = cleanAndTruncate(item);
    }
    return result;
  }
  return value;
}

/** Redacts secrets and personal data, then caps individual strings and total JSON size. */
export function redactArgs(args: unknown): unknown {
  let safe: unknown;
  try {
    safe = maskPersonalData(cleanAndTruncate(args));
    const serialized = JSON.stringify(safe);
    if (serialized === undefined) return undefined;
    const size = new TextEncoder().encode(serialized).byteLength;
    if (size > MAX_ARGS_BYTES) {
      // Oversized payloads use a deterministic compact marker rather than partial data.
      return { truncated: true, originalSize: size };
    }
    return safe;
  } catch {
    // JSON-compatible inputs should not throw; keep malformed/cyclic values non-fatal too.
    return { truncated: true };
  }
}

function eventData(e: Omit<PendingEventInput, "argsRedacted" | "tokenId"> & { argsRedacted?: unknown; errorMessage?: string }) {
  const { argsRedacted, ...rest } = e;
  return {
    ...rest,
    ...(argsRedacted === undefined ? {} : { argsRedacted: redactArgs(argsRedacted) as Prisma.InputJsonValue }),
    ...(e.errorMessage === undefined ? {} : { errorMessage: e.errorMessage.slice(0, MAX_STRING_LENGTH) }),
  };
}

export async function recordEvent(e: RecordEventInput): Promise<void> {
  const { tokenId, argsRedacted, ...rest } = e;
  await prisma.adminAuditEvent.create({
    data: {
      ...eventData({ ...rest, ...(argsRedacted === undefined ? {} : { argsRedacted }) }),
      ...(tokenId === undefined ? {} : { token: { connect: { id: tokenId } } }),
      status: e.status,
    },
  });
}

export async function startPendingEvent(e: PendingEventInput): Promise<string> {
  const { tokenId, argsRedacted, ...rest } = e;
  const created = await prisma.adminAuditEvent.create({
    data: {
      ...eventData({ ...rest, ...(argsRedacted === undefined ? {} : { argsRedacted }) }),
      ...(tokenId === undefined ? {} : { token: { connect: { id: tokenId } } }),
      status: "pending",
    },
    select: { id: true },
  });
  return created.id;
}

export async function finalizeEvent(id: string, update: FinalEventUpdate): Promise<void> {
  await prisma.adminAuditEvent.update({
    where: { id },
    data: {
      ...update,
      ...(update.errorMessage === undefined ? {} : { errorMessage: update.errorMessage.slice(0, MAX_STRING_LENGTH) }),
    },
  });
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const separator = decoded.indexOf("|");
    if (separator < 0) return null;
    const createdAt = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    return Number.isNaN(createdAt.getTime()) || !id ? null : { createdAt, id };
  } catch {
    return null;
  }
}

export async function queryEvents(
  filters: AuditQueryFilters,
  cursor?: string,
  limit = 20,
): Promise<{ items: unknown[]; nextCursor: string | null }> {
  const take = Math.max(1, Math.min(Math.floor(limit) || 20, 100));
  const where: Prisma.AdminAuditEventWhereInput = {};
  for (const key of ["actorType", "source", "domain", "action", "tool", "tokenId", "actorUserId", "status"] as const) {
    if (filters[key] !== undefined) Object.assign(where, { [key]: filters[key] });
  }
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.q) {
    where.OR = SEARCH_FIELDS.map((field) => ({ [field]: { contains: filters.q, mode: "insensitive" } }));
  }

  // Cursor encodes the full sort key; lexicographic continuation avoids Prisma's id-only cursor skips.
  const decoded = cursor ? decodeCursor(cursor) : null;
  if (decoded) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { createdAt: { lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, id: { lt: decoded.id } },
        ],
      },
    ];
  }

  const rows = await prisma.adminAuditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const last = items.at(-1) as { id: string; createdAt: Date } | undefined;
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}
