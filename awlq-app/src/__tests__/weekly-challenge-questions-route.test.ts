/**
 * GET /api/weekly-challenge/questions — regression test.
 *
 * Locks in two fixes: (1) a broken fetch in WeeklyChallengeScreen pointed at a
 * nonexistent /api/study/questions route; (2) the question set is now fixed at
 * challenge-open time (WeeklyChallenge.questionIds) so every participant answers
 * the same questions that week — this route serves that fixed set rather than
 * picking a fresh random batch per request/user.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockRequireApprovedUser, mockPrisma } = vi.hoisted(() => {
  const mockRequireApprovedUser = vi.fn();
  const mockPrisma = {
    weeklyChallenge: {
      findFirst: vi.fn(),
    },
    studyQuestion: {
      findMany: vi.fn(),
    },
  };
  return { mockRequireApprovedUser, mockPrisma };
});

vi.mock("@/lib/user-auth", () => ({ requireApprovedUser: mockRequireApprovedUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET as getQuestions } from "@/app/api/weekly-challenge/questions/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/weekly-challenge/questions");
}

const QUESTION_ROW = {
  id: "q1",
  statement: "Q",
  optionA: "A",
  optionB: "B",
  optionC: "C",
  optionD: "D",
  optionE: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApprovedUser.mockResolvedValue({ user: { id: "user-weekly" }, response: null });
});

describe("GET /api/weekly-challenge/questions", () => {
  it("returns the unauthorized response when not logged in", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mockRequireApprovedUser.mockResolvedValue({ user: null, response: unauthorized });

    const res = await getQuestions(makeRequest());

    expect(res.status).toBe(401);
    expect(mockPrisma.weeklyChallenge.findFirst).not.toHaveBeenCalled();
  });

  it("returns an empty array when there is no active challenge", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue(null);

    const res = await getQuestions(makeRequest());
    const body = (await res.json()) as { questions: unknown[] };

    expect(res.status).toBe(200);
    expect(body.questions).toEqual([]);
  });

  it("fetches exactly the challenge's fixed questionIds, not a fresh random pool", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue({ questionIds: ["q1", "q2", "q3"] });
    mockPrisma.studyQuestion.findMany.mockResolvedValue([
      QUESTION_ROW,
      { ...QUESTION_ROW, id: "q2" },
      { ...QUESTION_ROW, id: "q3" },
    ]);

    const res = await getQuestions(makeRequest());
    const body = (await res.json()) as { questions: Array<{ id: string }> };

    expect(res.status).toBe(200);
    expect(mockPrisma.studyQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["q1", "q2", "q3"] } }) }),
    );
    expect(body.questions.map((q) => q.id).sort()).toEqual(["q1", "q2", "q3"]);
  });

  it("falls back to a weighted random pick for legacy challenges with no stored questionIds", async () => {
    mockPrisma.weeklyChallenge.findFirst.mockResolvedValue({ questionIds: null });
    // First call: fallback pool selection (id + difficulty). Second call: full question fetch.
    mockPrisma.studyQuestion.findMany
      .mockResolvedValueOnce([
        { id: "q1", difficulty: "hard" },
        { id: "q2", difficulty: "medium" },
      ])
      .mockResolvedValueOnce([QUESTION_ROW, { ...QUESTION_ROW, id: "q2" }]);

    const res = await getQuestions(makeRequest());
    const body = (await res.json()) as { questions: Array<{ id: string }> };

    expect(res.status).toBe(200);
    expect(body.questions.length).toBeGreaterThan(0);

    const fallbackPoolCall = mockPrisma.studyQuestion.findMany.mock.calls[0][0];
    expect(fallbackPoolCall.where.difficulty).toEqual({ in: ["medium", "hard", "nightmare"] });
  });
});
