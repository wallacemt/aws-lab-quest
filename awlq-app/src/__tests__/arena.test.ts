/**
 * Arena test suite — TC-045
 *
 * Locks the boss battle victory gate (LSF-2026-001): a user who has already
 * defeated a boss must not be allowed to re-battle it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockRequireApprovedUser, mockPrisma } = vi.hoisted(() => {
  const SESSION_USER = { id: "user-arena", email: "arena@example.com" };

  const mockRequireApprovedUser = vi
    .fn()
    .mockResolvedValue({ user: SESSION_USER, response: null });

  const mockPrisma = {
    boss: {
      findUnique: vi.fn(),
    },
    bossBattle: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    awsService: {
      findUnique: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    studyQuestion: {
      findMany: vi.fn(),
    },
    studySessionHistory: {
      create: vi.fn().mockResolvedValue({ id: "hist-arena" }),
    },
    xpWeightConfig: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  return { mockRequireApprovedUser, mockPrisma };
});

vi.mock("@/lib/user-auth", () => ({ requireApprovedUser: mockRequireApprovedUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/achievements", () => ({ syncAndGetNewAchievements: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/xp-weights", () => ({
  applyWeightedXp: vi.fn().mockReturnValue(50),
  listXpWeightsByActivity: vi.fn().mockResolvedValue([]),
  resolveXpWeight: vi.fn().mockReturnValue({ multiplier: 1, bonusXp: 0 }),
}));
vi.mock("@/lib/levels", () => ({
  getTaskXpByDifficulty: vi.fn().mockReturnValue(60),
}));
vi.mock("@/lib/streak", () => ({ recordStudyActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/realtime-events", () => ({ publishLeaderboardUpdatedEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/cache", () => ({
  CACHE_KEYS: {
    userStudyHistory: (id: string) => `user:study-history:${id}`,
    userPublicProfile: (id: string) => `user:public:${id}`,
    userAchievements: (id: string) => `user:achievements:${id}`,
    leaderboard: () => "global:leaderboard",
  },
  cacheDel: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Route handler imported after mocks
// ---------------------------------------------------------------------------

import { POST as arenaPost } from "@/app/api/arena/battle/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_BOSS = {
  id: "boss-1",
  name: "S3 Titan",
  active: true,
  themeService: "s3",
  maxHp: 100,
  damagePerCorrect: 10,
};

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/arena/battle", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  const SESSION_USER = { id: "user-arena", email: "arena@example.com" };
  mockRequireApprovedUser.mockResolvedValue({ user: SESSION_USER, response: null });
  mockPrisma.studySessionHistory.create.mockResolvedValue({ id: "hist-arena" });
  mockPrisma.xpWeightConfig.findMany.mockResolvedValue([]);
  mockPrisma.userProfile.findUnique.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// TC-045: Boss battle victory gate blocks rematch (LSF-2026-001)
// ---------------------------------------------------------------------------

describe("TC-045: Arena — victory gate blocks boss rematch", () => {
  it("returns 409 with alreadyDefeated:true when prior victory exists", async () => {
    // Setup: boss exists and is active
    mockPrisma.boss.findUnique.mockResolvedValue(ACTIVE_BOSS);
    // Prior victory row found — user already defeated this boss
    mockPrisma.bossBattle.findFirst.mockResolvedValue({ id: "prior-victory" });

    const req = makePostRequest({
      bossId: "boss-1",
      answers: [{ questionId: "q1", selectedOption: 0 }],
    });

    const res = await arenaPost(req);

    expect(res.status).toBe(409);
    const body = await res.json() as { alreadyDefeated: boolean };
    expect(body.alreadyDefeated).toBe(true);
  });

  it("does not attempt to score answers when a prior victory is found", async () => {
    mockPrisma.boss.findUnique.mockResolvedValue(ACTIVE_BOSS);
    mockPrisma.bossBattle.findFirst.mockResolvedValue({ id: "prior-victory" });

    const req = makePostRequest({
      bossId: "boss-1",
      answers: [{ questionId: "q1", selectedOption: 0 }],
    });

    await arenaPost(req);

    // studyQuestion.findMany must not be called — no scoring should occur
    expect(mockPrisma.studyQuestion.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 when boss does not exist", async () => {
    mockPrisma.boss.findUnique.mockResolvedValue(null);

    const req = makePostRequest({
      bossId: "nonexistent-boss",
      answers: [{ questionId: "q1", selectedOption: 0 }],
    });

    const res = await arenaPost(req);

    expect(res.status).toBe(404);
  });

  it("allows battle when no prior victory exists", async () => {
    mockPrisma.boss.findUnique.mockResolvedValue(ACTIVE_BOSS);
    // No prior victory
    mockPrisma.bossBattle.findFirst
      .mockResolvedValueOnce(null)  // victory check → no prior victory
      .mockResolvedValueOnce(null); // active battle lookup → none exists yet
    mockPrisma.bossBattle.create.mockResolvedValue({
      id: "battle-new",
      remainingHp: 100,
      streak: 0,
      correctCount: 0,
      totalAnswered: 0,
      gainedXp: 0,
      victory: false,
    });
    mockPrisma.awsService.findUnique.mockResolvedValue({ name: "S3" });
    mockPrisma.studyQuestion.findMany
      .mockResolvedValueOnce([{ id: "q1" }]) // authorised pool
      .mockResolvedValueOnce([{ id: "q1", correctOption: "A", topic: "s3", difficulty: "medium" }]); // scored questions
    mockPrisma.bossBattle.update.mockResolvedValue({});

    const req = makePostRequest({
      bossId: "boss-1",
      answers: [{ questionId: "q1", selectedOption: 0 }],
    });

    const res = await arenaPost(req);

    // Should not be 409 — battle was allowed
    expect(res.status).not.toBe(409);
  });
});
