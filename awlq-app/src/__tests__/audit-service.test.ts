import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate, mockUpdate, mockFindMany } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { adminAuditEvent: { create: mockCreate, update: mockUpdate, findMany: mockFindMany } },
}));

import { finalizeEvent, queryEvents, redactArgs, recordEvent, startPendingEvent } from "@/features/audit/server/audit-service";
import { routeDomain } from "@/features/audit/server/route-domain";

beforeEach(() => vi.clearAllMocks());

describe("redactArgs", () => {
  it("removes sensitive keys at any depth and masks personal data", () => {
    expect(redactArgs({ password: "p", nested: { apiKey: "k", email: "person@example.com" } })).toEqual({
      nested: { email: "p***@e***.com" },
    });
  });

  it("truncates long strings and replaces JSON payloads over 4 KB with a size marker", () => {
    const longString = redactArgs({ text: "x".repeat(600) }) as { text: string };
    expect(longString.text).toBe(`${"x".repeat(500)}...[truncado]`);

    const oversized = redactArgs(Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`field${index}`, "y".repeat(500)])));
    expect(oversized).toEqual({ truncated: true, originalSize: expect.any(Number) });
  });
});

describe("audit writes", () => {
  it("propagates pending insert failures", async () => {
    const failure = new Error("database unavailable");
    mockCreate.mockRejectedValue(failure);
    await expect(startPendingEvent({
      requestId: "req-1", actorType: "agent", source: "mcp", actorUserId: "u-1", actorEmail: "a@example.com",
      domain: "users", action: "approve", path: "users/u-2/approve",
    })).rejects.toBe(failure);
  });

  it("writes a final event and finalizes a pending event", async () => {
    mockCreate.mockResolvedValue({ id: "audit-1" });
    await recordEvent({
      requestId: "req-1", actorType: "human", source: "admin_ui", actorUserId: "u-1", actorEmail: "a@example.com",
      domain: "users", action: "view", path: "users",
      status: "ok",
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ok" }) }));

    await finalizeEvent("audit-1", { status: "error", httpStatus: 500 });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "audit-1" }, data: { status: "error", httpStatus: 500 } });
  });
});

describe("queryEvents", () => {
  it("combines filters and advances by a stable createdAt/id cursor without duplicate rows", async () => {
    const first = { id: "a2", createdAt: new Date("2026-01-01T00:00:00.000Z") };
    const second = { id: "a1", createdAt: first.createdAt };
    mockFindMany.mockResolvedValueOnce([first, second, { id: "a0", createdAt: first.createdAt }]);
    mockFindMany.mockResolvedValueOnce([{ id: "a0", createdAt: first.createdAt }]);

    const page1 = await queryEvents({ actorType: "agent", domain: "users", status: "error", q: "APPROVE" }, undefined, 2);
    expect(page1.items).toEqual([first, second]);
    expect(page1.nextCursor).toBeTruthy();
    const firstArgs = mockFindMany.mock.calls[0][0];
    expect(firstArgs.where).toMatchObject({ actorType: "agent", domain: "users", status: "error" });
    expect(firstArgs.where.OR).toEqual(expect.arrayContaining([
      { action: { contains: "APPROVE", mode: "insensitive" } },
      { errorMessage: { contains: "APPROVE", mode: "insensitive" } },
    ]));
    expect(firstArgs.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);

    const page2 = await queryEvents({ actorType: "agent", domain: "users", status: "error", q: "APPROVE" }, page1.nextCursor!, 2);
    expect(page2.items).toEqual([{ id: "a0", createdAt: first.createdAt }]);
    expect(page2.nextCursor).toBeNull();
    expect(mockFindMany.mock.calls[1][0].where.AND).toEqual([{
      OR: [
        { createdAt: { lt: first.createdAt } },
        { createdAt: first.createdAt, id: { lt: "a1" } },
      ],
    }]);
  });

  it("caps the requested limit at 100", async () => {
    mockFindMany.mockResolvedValue([]);
    await queryEvents({}, undefined, 500);
    expect(mockFindMany.mock.calls[0][0].take).toBe(101);
  });
});

describe("routeDomain", () => {
  it.each([
    ["users/123", "users"], ["questions", "questions"], ["uploads/1", "ingestion"],
    ["pdf/1", "ingestion"], ["ingestion-sources", "ingestion"], ["simulado-packs/1", "simulados"],
    ["achievements", "gamification"], ["arena", "gamification"], ["themes", "gamification"],
    ["weekly-challenge", "gamification"], ["trails", "content"], ["certifications", "content"],
    ["library", "content"], ["changelog", "content"], ["news-sources", "content"], ["home-config", "content"],
    ["email", "email"], ["behavioral-email", "email"], ["worker", "ops"], ["scheduled-jobs", "ops"],
    ["status", "ops"], ["system-health", "ops"], ["config", "ops"], ["ai-config", "ops"],
    ["openrouter-models", "ops"], ["pollinations-models", "ops"], ["metrics", "metrics"],
    ["mcp", "platform"], ["audit", "platform"], ["unknown/path", "platform"],
  ])("maps %s to %s", (path, domain) => expect(routeDomain(path)).toBe(domain));
});
