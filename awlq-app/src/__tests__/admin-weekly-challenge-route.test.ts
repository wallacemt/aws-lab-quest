/**
 * Admin weekly-challenge management route tests.
 *
 * Covers: 401/403 without an admin session, PATCH deactivating every other
 * active challenge when activating one (only one challenge may be "current"
 * for the user-facing GET /api/weekly-challenge, which picks by weekStart desc),
 * and the manual trigger route writing a WorkerTrigger row for the worker to pick up.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockRequireAdmin, mockPrisma } = vi.hoisted(() => {
  const mockRequireAdmin = vi.fn();
  const mockPrisma = {
    weeklyChallenge: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    workerTrigger: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockRequireAdmin, mockPrisma };
});

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET as listChallenges } from "@/app/api/admin/weekly-challenge/route";
import { PATCH as patchChallenge } from "@/app/api/admin/weekly-challenge/[challengeId]/route";
import { POST as triggerChallenge } from "@/app/api/admin/weekly-challenge/trigger/route";

const ADMIN_OK = { ok: true as const, userId: "admin-1", email: "admin@test.com", role: "admin" };
const NOT_ADMIN = {
  ok: false as const,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
};

function makeGetRequest(url = "http://localhost/api/admin/weekly-challenge") {
  return new NextRequest(url);
}

function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/weekly-challenge/challenge-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeTriggerRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/weekly-challenge/trigger", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Admin weekly-challenge routes — auth gate", () => {
  it("returns 403 without an admin session on every route", async () => {
    mockRequireAdmin.mockResolvedValue(NOT_ADMIN);

    const listRes = await listChallenges(makeGetRequest());
    expect(listRes.status).toBe(403);
    expect(mockPrisma.weeklyChallenge.findMany).not.toHaveBeenCalled();

    const patchRes = await patchChallenge(makePatchRequest({ active: true }), {
      params: Promise.resolve({ challengeId: "challenge-1" }),
    });
    expect(patchRes.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();

    const triggerRes = await triggerChallenge(makeTriggerRequest({ mode: "open" }));
    expect(triggerRes.status).toBe(403);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/weekly-challenge/[challengeId] — activation", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
  });

  it("deactivates every other challenge before activating the target one", async () => {
    mockPrisma.weeklyChallenge.findUnique.mockResolvedValue({ id: "challenge-1" });

    const txUpdateMany = vi.fn();
    const txUpdate = vi.fn().mockResolvedValue({ id: "challenge-1", active: true });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const tx = {
        weeklyChallenge: { updateMany: txUpdateMany, update: txUpdate },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const res = await patchChallenge(makePatchRequest({ active: true }), {
      params: Promise.resolve({ challengeId: "challenge-1" }),
    });

    expect(res.status).toBe(200);
    expect(txUpdateMany).toHaveBeenCalledWith({
      where: { active: true, NOT: { id: "challenge-1" } },
      data: { active: false },
    });
    expect(txUpdate).toHaveBeenCalledWith({ where: { id: "challenge-1" }, data: { active: true } });
  });

  it("does not touch other challenges when deactivating", async () => {
    mockPrisma.weeklyChallenge.findUnique.mockResolvedValue({ id: "challenge-1" });

    const txUpdateMany = vi.fn();
    const txUpdate = vi.fn().mockResolvedValue({ id: "challenge-1", active: false });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const tx = {
        weeklyChallenge: { updateMany: txUpdateMany, update: txUpdate },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const res = await patchChallenge(makePatchRequest({ active: false }), {
      params: Promise.resolve({ challengeId: "challenge-1" }),
    });

    expect(res.status).toBe(200);
    expect(txUpdateMany).not.toHaveBeenCalled();
    expect(txUpdate).toHaveBeenCalledWith({ where: { id: "challenge-1" }, data: { active: false } });
  });

  it("returns 404 when the challenge does not exist", async () => {
    mockPrisma.weeklyChallenge.findUnique.mockResolvedValue(null);

    const res = await patchChallenge(makePatchRequest({ active: true }), {
      params: Promise.resolve({ challengeId: "missing" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 when 'active' is missing or not boolean", async () => {
    const res = await patchChallenge(makePatchRequest({}), {
      params: Promise.resolve({ challengeId: "challenge-1" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/weekly-challenge/trigger", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
  });

  it("writes a WorkerTrigger row with the requested mode", async () => {
    mockPrisma.workerTrigger.create.mockResolvedValue({ id: "trigger-1" });

    const res = await triggerChallenge(makeTriggerRequest({ mode: "close" }));

    expect(res.status).toBe(200);
    expect(mockPrisma.workerTrigger.create).toHaveBeenCalledWith({
      data: { action: "weekly-challenge-force", source: "manual", payload: { mode: "close" } },
    });
  });

  it("rejects an invalid mode", async () => {
    const res = await triggerChallenge(makeTriggerRequest({ mode: "invalid" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();
  });
});
