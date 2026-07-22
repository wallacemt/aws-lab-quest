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
      count: vi.fn(),
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
vi.mock("@/lib/realtime-events", () => ({
  publishWeeklyChallengeUpdatedEvent: vi.fn().mockResolvedValue(undefined),
}));
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

import { GET as weeklyGet, POST as weeklyPost } from "@/app/api/weekly-challenge/route";

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

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/weekly-challenge");
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

  it("stores a full answersSnapshot (statement/options/explanations) and returns historyId, so the history review UI doesn't crash", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(ACTIVE_CHALLENGE);
    mockPrisma.studyQuestion.findMany.mockResolvedValue([
      {
        id: "q1",
        statement: "What is EC2?",
        correctOption: "A",
        topic: "ec2",
        difficulty: "medium",
        optionA: "Compute",
        optionB: "Storage",
        optionC: "Network",
        optionD: "Database",
        optionE: null,
        explanationA: "Correct — EC2 is compute.",
        explanationB: "Wrong.",
        explanationC: "Wrong.",
        explanationD: "Wrong.",
        explanationE: null,
      },
    ]);
    mockPrisma.studySessionHistory.create.mockResolvedValue({ id: "hist-review-123" });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      const tx = {
        weeklyChallengeEntry: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "new-entry" }),
        },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const req = makePostRequest({ answers: [{ questionId: "q1", selectedOption: 0 }] });
    const res = await weeklyPost(req);
    const body = (await res.json()) as { historyId: string };

    expect(res.status).toBe(200);
    expect(body.historyId).toBe("hist-review-123");
    expect(mockPrisma.studySessionHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answersSnapshot: [
            expect.objectContaining({
              questionId: "q1",
              statement: "What is EC2?",
              selectedOption: "A",
              correctOption: "A",
              options: expect.objectContaining({ A: "Compute", B: "Storage" }),
              explanations: expect.objectContaining({ A: "Correct — EC2 is compute." }),
            }),
          ],
        }),
        select: { id: true },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST — answers are restricted to the challenge's fixed questionIds
// ---------------------------------------------------------------------------

describe("POST /api/weekly-challenge — fixed question set", () => {
  it("ignores an answer for a question outside the challenge's questionIds", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue({ ...ACTIVE_CHALLENGE, questionIds: ["q1"] });
    // Only q1 is authorized; q2 must never even be queried for since it's filtered
    // out of idsToScore before the studyQuestion.findMany call.
    mockPrisma.studyQuestion.findMany.mockResolvedValue([
      { id: "q1", correctOption: "A", topic: "iam", difficulty: "medium" },
    ]);

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      const tx = {
        weeklyChallengeEntry: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "new-entry" }),
        },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const req = makePostRequest({
      answers: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });
    const res = await weeklyPost(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.studyQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["q1"] } }) }),
    );
  });
});

// ---------------------------------------------------------------------------
// GET — leaderboard entries include name/avatarUrl, and a live rank is
// computed for the current user while the challenge is still open.
// ---------------------------------------------------------------------------

describe("GET /api/weekly-challenge", () => {
  it("returns null challenge/entry with an empty leaderboard when nothing is active", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(null);

    const res = await weeklyGet(makeGetRequest());
    const body = (await res.json()) as { challenge: unknown; entry: unknown; leaderboard: unknown[] };

    expect(body.challenge).toBeNull();
    expect(body.entry).toBeNull();
    expect(body.leaderboard).toEqual([]);
  });

  it("includes name/avatarUrl on leaderboard entries", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(ACTIVE_CHALLENGE);
    mockPrisma.weeklyChallengeEntry.findUnique.mockResolvedValue(null);
    mockPrisma.weeklyChallengeEntry.findMany.mockResolvedValue([
      {
        userId: "user-other",
        score: 9,
        rank: null,
        user: { name: "Outro Usuario", profile: { avatarUrl: "https://x/avatar.png" } },
      },
    ]);

    const res = await weeklyGet(makeGetRequest());
    const body = (await res.json()) as { leaderboard: Array<{ name: string; avatarUrl: string | null }> };

    expect(body.leaderboard[0]).toMatchObject({ name: "Outro Usuario", avatarUrl: "https://x/avatar.png" });
  });

  it("computes a live rank for the current user when the challenge is still active (rank not yet finalized)", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(ACTIVE_CHALLENGE);
    mockPrisma.weeklyChallengeEntry.findUnique.mockResolvedValue({
      score: 5,
      rank: null,
      gainedXp: 30,
      updatedAt: new Date("2026-06-03"),
      user: { name: "User Weekly", profile: { avatarUrl: null } },
    });
    mockPrisma.weeklyChallengeEntry.findMany.mockResolvedValue([]);
    mockPrisma.weeklyChallengeEntry.count.mockResolvedValue(10);

    const res = await weeklyGet(makeGetRequest());
    const body = (await res.json()) as { entry: { rank: number | null; liveRank: number | null } };

    expect(body.entry.rank).toBeNull();
    expect(body.entry.liveRank).toBe(11);
    expect(mockPrisma.weeklyChallengeEntry.count).toHaveBeenCalledTimes(1);
  });

  it("uses the stored rank as liveRank once the challenge has closed, skipping the count query", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(ACTIVE_CHALLENGE);
    mockPrisma.weeklyChallengeEntry.findUnique.mockResolvedValue({
      score: 5,
      rank: 3,
      gainedXp: 30,
      updatedAt: new Date("2026-06-03"),
      user: { name: "User Weekly", profile: { avatarUrl: null } },
    });
    mockPrisma.weeklyChallengeEntry.findMany.mockResolvedValue([]);

    const res = await weeklyGet(makeGetRequest());
    const body = (await res.json()) as { entry: { rank: number | null; liveRank: number | null } };

    expect(body.entry.rank).toBe(3);
    expect(body.entry.liveRank).toBe(3);
    expect(mockPrisma.weeklyChallengeEntry.count).not.toHaveBeenCalled();
  });
});
