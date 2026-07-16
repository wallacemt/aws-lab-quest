/**
 * Admin achievements CRUD route tests (Epic #50, Story 1/2).
 *
 * Covers: 401/403 without an admin session, duplicate `code` -> 409, and
 * DELETE performing a soft delete (active:false) rather than removing the row
 * — UserAchievement rows reference achievements and must survive deactivation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const { mockRequireAdmin, mockPrisma } = vi.hoisted(() => {
  const mockRequireAdmin = vi.fn();
  const mockPrisma = {
    achievement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockRequireAdmin, mockPrisma };
});

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/achievement-artwork", () => ({
  resolveAchievementArtworkForStorage: vi.fn().mockResolvedValue(null),
  deleteAchievementArtworkFromSupabase: vi.fn().mockResolvedValue(undefined),
}));

import { GET as listAchievements, POST as createAchievement } from "@/app/api/admin/achievements/route";
import { DELETE as deleteAchievement } from "@/app/api/admin/achievements/[achievementId]/route";

const ADMIN_OK = { ok: true as const, userId: "admin-1", email: "admin@test.com", role: "admin" };
const NOT_ADMIN = {
  ok: false as const,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
};

function makeRequest(body?: unknown) {
  return new NextRequest("http://localhost/api/admin/achievements", {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = {
  code: "new_achievement",
  name: "Nova Conquista",
  description: "Descricao de teste.",
  triggerType: "XP_TOTAL",
  target: 500,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET/POST /api/admin/achievements — auth gate", () => {
  it("returns 401/403 (whatever requireAdmin returns) without an admin session", async () => {
    mockRequireAdmin.mockResolvedValue(NOT_ADMIN);

    const getRes = await listAchievements(makeRequest());
    expect(getRes.status).toBe(403);
    expect(mockPrisma.achievement.findMany).not.toHaveBeenCalled();

    const postRes = await createAchievement(makeRequest(VALID_BODY));
    expect(postRes.status).toBe(403);
    expect(mockPrisma.achievement.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/achievements — validation and creation", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
  });

  it("creates an achievement when the body is valid", async () => {
    mockPrisma.achievement.create.mockResolvedValue({ id: "achv-1", ...VALID_BODY });

    const res = await createAchievement(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(mockPrisma.achievement.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a body with an unknown triggerType before hitting Prisma", async () => {
    const res = await createAchievement(makeRequest({ ...VALID_BODY, triggerType: "NOT_A_REAL_TYPE" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.achievement.create).not.toHaveBeenCalled();
  });

  it("rejects SESSION_COUNT without a sessionType in triggerParams", async () => {
    const res = await createAchievement(
      makeRequest({ ...VALID_BODY, triggerType: "SESSION_COUNT", triggerParams: {} }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.achievement.create).not.toHaveBeenCalled();
  });

  it("returns 409 when Prisma reports a duplicate code (P2002)", async () => {
    mockPrisma.achievement.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await createAchievement(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/admin/achievements/[achievementId] — soft delete", () => {
  it("deactivates the achievement instead of deleting the row", async () => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
    mockPrisma.achievement.findUnique.mockResolvedValue({ id: "achv-1", active: true });
    mockPrisma.achievement.update.mockResolvedValue({ id: "achv-1", active: false });

    const req = new NextRequest("http://localhost/api/admin/achievements/achv-1", { method: "DELETE" });
    const res = await deleteAchievement(req, { params: Promise.resolve({ achievementId: "achv-1" }) });

    expect(res.status).toBe(200);
    expect(mockPrisma.achievement.update).toHaveBeenCalledWith({
      where: { id: "achv-1" },
      data: { active: false },
    });
  });

  it("returns 404 when the achievement does not exist", async () => {
    mockRequireAdmin.mockResolvedValue(ADMIN_OK);
    mockPrisma.achievement.findUnique.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/admin/achievements/missing", { method: "DELETE" });
    const res = await deleteAchievement(req, { params: Promise.resolve({ achievementId: "missing" }) });

    expect(res.status).toBe(404);
    expect(mockPrisma.achievement.update).not.toHaveBeenCalled();
  });
});
