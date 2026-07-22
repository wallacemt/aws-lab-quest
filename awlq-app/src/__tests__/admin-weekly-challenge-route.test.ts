/**
 * Admin weekly-challenge management route tests (Epic #54, Story 3).
 *
 * Covers: 401/403 auth gate on all three routes, PATCH activation deactivating
 * every other active challenge inside the same transaction, PATCH deactivation
 * leaving other challenges untouched, 404/400 validation, and the trigger
 * route writing the correct WorkerTrigger payload for open/close.
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
    scheduledJob: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
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
import { GET as getChallenge, PATCH as patchChallenge } from "@/app/api/admin/weekly-challenge/[challengeId]/route";
import { POST as triggerChallenge } from "@/app/api/admin/weekly-challenge/trigger/route";
import { POST as pauseChallenge } from "@/app/api/admin/weekly-challenge/pause/route";

const ADMIN_OK = { ok: true as const, userId: "admin-1", email: "admin@test.com", role: "admin" };
const NOT_ADMIN = {
  ok: false as const,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
};

function makeRequest(url: string, body?: unknown, method?: string) {
  return new NextRequest(url, {
    method: method ?? (body ? "PATCH" : "GET"),
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(challengeId: string) {
  return { params: Promise.resolve({ challengeId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Admin weekly-challenge routes — auth gate", () => {
  it("returns 403 without an admin session on all three routes", async () => {
    mockRequireAdmin.mockResolvedValue(NOT_ADMIN);

    const listRes = await listChallenges(makeRequest("http://localhost/api/admin/weekly-challenge"));
    expect(listRes.status).toBe(403);
    expect(mockPrisma.weeklyChallenge.findMany).not.toHaveBeenCalled();

    const patchRes = await patchChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/c1", { active: true }),
      makeParams("c1")
    );
    expect(patchRes.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();

    const triggerRes = await triggerChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/trigger", { mode: "open" }, "POST")
    );
    expect(triggerRes.status).toBe(403);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();

    const pauseRes = await pauseChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/pause", { paused: true }, "POST")
    );
    expect(pauseRes.status).toBe(403);
    expect(mockPrisma.scheduledJob.upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/weekly-challenge — list", () => {
  it("reports openCronPaused based on the cron-weekly-challenge-open ScheduledJob", async () => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
    mockPrisma.weeklyChallenge.findMany.mockResolvedValue([]);
    mockPrisma.scheduledJob.findUnique.mockResolvedValue({ active: false });

    const res = await listChallenges(makeRequest("http://localhost/api/admin/weekly-challenge"));
    const body = (await res.json()) as { openCronPaused: boolean };

    expect(res.status).toBe(200);
    expect(body.openCronPaused).toBe(true);
  });

  it("reports openCronPaused=false when no ScheduledJob row exists yet", async () => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
    mockPrisma.weeklyChallenge.findMany.mockResolvedValue([]);
    mockPrisma.scheduledJob.findUnique.mockResolvedValue(null);

    const res = await listChallenges(makeRequest("http://localhost/api/admin/weekly-challenge"));
    const body = (await res.json()) as { openCronPaused: boolean };

    expect(body.openCronPaused).toBe(false);
  });
});

describe("POST /api/admin/weekly-challenge/pause", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
  });

  it("disables the open cron job when paused:true", async () => {
    mockPrisma.scheduledJob.upsert.mockResolvedValue({ active: false });

    const res = await pauseChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/pause", { paused: true }, "POST")
    );
    const body = (await res.json()) as { paused: boolean };

    expect(res.status).toBe(200);
    expect(body.paused).toBe(true);
    expect(mockPrisma.scheduledJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: "cron-weekly-challenge-open" },
        update: { active: false },
      }),
    );
  });

  it("re-enables the open cron job when paused:false", async () => {
    mockPrisma.scheduledJob.upsert.mockResolvedValue({ active: true });

    const res = await pauseChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/pause", { paused: false }, "POST")
    );
    const body = (await res.json()) as { paused: boolean };

    expect(res.status).toBe(200);
    expect(body.paused).toBe(false);
    expect(mockPrisma.scheduledJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: "cron-weekly-challenge-open" },
        update: { active: true },
      }),
    );
  });

  it("returns 400 when 'paused' is not a boolean", async () => {
    const res = await pauseChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/pause", { paused: "yes" }, "POST")
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.scheduledJob.upsert).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/weekly-challenge/[challengeId] — activation", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
    mockPrisma.weeklyChallenge.findUnique.mockResolvedValue({ id: "c1" });
  });

  it("deactivates every other active challenge when activating one", async () => {
    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
    const updateMock = vi.fn().mockResolvedValue({ id: "c1", active: true });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const tx = {
        weeklyChallenge: { updateMany: updateManyMock, update: updateMock },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const res = await patchChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/c1", { active: true }),
      makeParams("c1")
    );

    expect(res.status).toBe(200);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { active: true, NOT: { id: "c1" } },
      data: { active: false },
    });
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "c1" }, data: { active: true } });
  });

  it("does not touch other challenges when deactivating one", async () => {
    const updateManyMock = vi.fn();
    const updateMock = vi.fn().mockResolvedValue({ id: "c1", active: false });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const tx = {
        weeklyChallenge: { updateMany: updateManyMock, update: updateMock },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const res = await patchChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/c1", { active: false }),
      makeParams("c1")
    );

    expect(res.status).toBe(200);
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "c1" }, data: { active: false } });
  });

  it("returns 404 when the challenge does not exist", async () => {
    mockPrisma.weeklyChallenge.findUnique.mockResolvedValue(null);

    const res = await patchChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/missing", { active: true }),
      makeParams("missing")
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when 'active' is not a boolean", async () => {
    const res = await patchChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/c1", { active: "yes" }),
      makeParams("c1")
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when neither 'active' nor 'title' is provided", async () => {
    const res = await patchChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/c1", {}),
      makeParams("c1")
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates only the title, without touching other active challenges", async () => {
    const updateManyMock = vi.fn();
    const updateMock = vi.fn().mockResolvedValue({ id: "c1", title: "Semana da IAM" });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const tx = {
        weeklyChallenge: { updateMany: updateManyMock, update: updateMock },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const res = await patchChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/c1", { title: "Semana da IAM" }),
      makeParams("c1")
    );

    expect(res.status).toBe(200);
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "c1" }, data: { title: "Semana da IAM" } });
  });
});

describe("GET /api/admin/weekly-challenge/[challengeId] — not found", () => {
  it("returns 404 when the challenge does not exist", async () => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
    mockPrisma.weeklyChallenge.findUnique.mockResolvedValue(null);

    const res = await getChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/missing", undefined, "GET"),
      makeParams("missing")
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/weekly-challenge/trigger", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
  });

  it("writes a WorkerTrigger row with the correct payload for 'open'", async () => {
    const res = await triggerChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/trigger", { mode: "open" }, "POST")
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.workerTrigger.create).toHaveBeenCalledWith({
      data: { action: "weekly-challenge-force", source: "manual", payload: { mode: "open" } },
    });
  });

  it("rejects an invalid mode", async () => {
    const res = await triggerChallenge(
      makeRequest("http://localhost/api/admin/weekly-challenge/trigger", { mode: "invalid" }, "POST")
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.workerTrigger.create).not.toHaveBeenCalled();
  });
});
