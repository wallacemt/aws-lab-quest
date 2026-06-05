/**
 * Weekly challenge test suite — TC-046
 *
 * Locks LSF-2026-003: duplicate weekly challenge submissions must be blocked
 * with a 409 response. The dedup check is performed inside a transaction to
 * close the TOCTOU window between check and insert.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockRequireApprovedUser, mockPrisma } = vi.hoisted(() => {
  const SESSION_USER = { id: "user-weekly", email: "weekly@example.com" };

  const mockRequireApprovedUser = vi
    .fn()
    .mockResolvedValue({ user: SESSION_USER, response: null });

  const mockPrisma = {
    weeklyChallenge: {
      findFirst: vi.fn(),
    },
    weeklyChallengeEntry: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    studyQuestion: {
      findMany: vi.fn(),
    },
    studySessionHistory: {
      create: vi.fn().mockResolvedValue({ id: "hist-weekly" }),
    },
    xpWeightConfig: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(),
  };

  return { mockRequireApprovedUser, mockPrisma };
});

vi.mock("@/lib/user-auth", () => ({ requireApprovedUser: mockRequireApprovedUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/achievements", () => ({ syncAndGetNewAchievements: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/xp-weights", () => ({
  applyWeightedXp: vi.fn().mockReturnValue(30),
  listXpWeightsByActivity: vi.fn().mockResolvedValue([]),
  resolveXpWeight: vi.fn().mockReturnValue({ multiplier: 1, bonusXp: 0 }),
}));
vi.mock("@/lib/levels", () => ({
  getTaskXpByDifficulty: vi.fn().mockReturnValue(60),
}));

// ---------------------------------------------------------------------------
// Route handler imported after mocks
// ---------------------------------------------------------------------------

import { POST as weeklyPost } from "@/app/api/weekly-challenge/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_CHALLENGE = {
  id: "challenge-week-1",
  weekStart: new Date("2026-06-02"),
  weekEnd: new Date("2026-06-08"),
  active: true,
};

const VALID_ANSWERS = [
  { questionId: "q1", selectedOption: 0 },
  { questionId: "q2", selectedOption: 1 },
];

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/weekly-challenge", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  const SESSION_USER = { id: "user-weekly", email: "weekly@example.com" };
  mockRequireApprovedUser.mockResolvedValue({ user: SESSION_USER, response: null });
  mockPrisma.studySessionHistory.create.mockResolvedValue({ id: "hist-weekly" });
  mockPrisma.xpWeightConfig.findMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// TC-046: Weekly challenge — duplicate submission is blocked with 409
// ---------------------------------------------------------------------------

describe("TC-046: Weekly challenge — duplicate submission blocked (LSF-2026-003)", () => {
  it("returns 409 when user already submitted for this challenge", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(ACTIVE_CHALLENGE);
    mockPrisma.studyQuestion.findMany.mockResolvedValue([
      { id: "q1", correctOption: "A", topic: "iam", difficulty: "easy" },
      { id: "q2", correctOption: "B", topic: "ec2", difficulty: "medium" },
    ]);

    // Transaction callback: findUnique returns existing entry → throws ALREADY_SUBMITTED
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      // Provide a transaction proxy where weeklyChallengeEntry.findUnique returns an existing row
      const tx = {
        weeklyChallengeEntry: {
          findUnique: vi.fn().mockResolvedValue({ id: "existing-entry" }),
          create: vi.fn(),
        },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const req = makePostRequest({ answers: VALID_ANSWERS });
    const res = await weeklyPost(req);

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/already submitted/i);
  });

  it("does not create a history entry when submission is duplicate", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(ACTIVE_CHALLENGE);
    mockPrisma.studyQuestion.findMany.mockResolvedValue([
      { id: "q1", correctOption: "A", topic: "iam", difficulty: "easy" },
    ]);

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      const tx = {
        weeklyChallengeEntry: {
          findUnique: vi.fn().mockResolvedValue({ id: "existing-entry" }),
          create: vi.fn(),
        },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const req = makePostRequest({ answers: [{ questionId: "q1", selectedOption: 0 }] });
    await weeklyPost(req);

    // No history record should be written for a duplicate submission
    expect(mockPrisma.studySessionHistory.create).not.toHaveBeenCalled();
  });

  it("returns 404 when no active challenge exists", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(null);

    const req = makePostRequest({ answers: VALID_ANSWERS });
    const res = await weeklyPost(req);

    expect(res.status).toBe(404);
  });

  it("succeeds on first submission when no prior entry exists", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(ACTIVE_CHALLENGE);
    mockPrisma.studyQuestion.findMany.mockResolvedValue([
      { id: "q1", correctOption: "A", topic: "iam", difficulty: "easy" },
    ]);

    // Transaction callback: no existing entry → create succeeds
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      const tx = {
        weeklyChallengeEntry: {
          findUnique: vi.fn().mockResolvedValue(null), // no prior submission
          create: vi.fn().mockResolvedValue({ id: "new-entry" }),
        },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const req = makePostRequest({ answers: [{ questionId: "q1", selectedOption: 0 }] });
    const res = await weeklyPost(req);

    expect(res.status).toBe(200);
  });
});
