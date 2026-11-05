import { describe, expect, it } from "vitest";
import { groupAuditEventsByDay, mergeAuditPages, readAuditFilters, writeAuditFilters } from "@/features/audit/services/audit-admin";
import type { AuditEventDTO, AuditPage } from "@/features/audit/types";

const event = (id: string, createdAt: string): AuditEventDTO => ({
  id, requestId: id, createdAt, actorType: "agent", source: "mcp", actorUserId: "u", actorEmail: "admin@example.com", tokenId: "t", tokenName: "agent", tool: null, domain: "platform", action: "GET audit", path: "audit", resourceId: null, status: "ok", httpStatus: 200, durationMs: 3, argsRedacted: null, errorMessage: null, ip: null, userAgent: null,
});

describe("admin audit UI helpers", () => {
  it("merges cursor pages before grouping so a day header is not duplicated", () => {
    const first: AuditPage = { items: [event("a", "2026-11-04T10:00:00.000Z")], nextCursor: "next" };
    const second: AuditPage = { items: [event("b", "2026-11-04T09:00:00.000Z")], nextCursor: null };
    const merged = mergeAuditPages([first, second]);
    expect(merged.items).toHaveLength(2);
    expect(groupAuditEventsByDay(merged.items, new Date("2026-11-04T12:00:00.000Z"))).toHaveLength(1);
  });

  it("round trips filter state through the query string", () => {
    const filters = { actorType: "agent", tokenId: "token-123", domain: "platform", q: "audit" };
    expect(readAuditFilters(writeAuditFilters(filters))).toEqual(filters);
  });
});
