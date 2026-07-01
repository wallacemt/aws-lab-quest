/**
 * KC Step Flow test suite — TC-001 to TC-007
 *
 * Locks the on-demand KC generation flow:
 *   TC-001 gap detection reads latest report and filters correctly
 *   TC-002 difficulty-aware WHERE per topic class
 *   TC-003 wizard start gating at the API level
 *   TC-004 empty pool enters 200+insufficient (not 404)
 *   TC-005 poll readiness honours difficulty filter
 *   TC-006 timeout fallback and re-fetch failure both recover
 *   TC-007 multi-topic gap fill covers all services
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be set up before any module imports)
// ---------------------------------------------------------------------------

const { mockGetSession, mockPrisma } = vi.hoisted(() => {
  const mockGetSession = vi.fn().mockResolvedValue(null);

  const mockPrisma = {
    weakAreaReport: {
      findFirst: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
    studyQuestion: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    workerTrigger: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "trigger-1" }),
    },
  };

  return { mockGetSession, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mockGetSession } } }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/study-questions", () => ({
  mapDbQuestionToStudyQuestion: vi.fn((q: unknown) => q),
  pickRandomItems: vi.fn((arr: unknown[]) => arr),
}));

// ---------------------------------------------------------------------------
// Route handlers and helpers imported after mocks
// ---------------------------------------------------------------------------

import { POST as kcQuestionsPost } from "@/app/api/study/kc/questions/route";
import { GET as generateStatusGet } from "@/app/api/study/kc/generate-status/route";
import { fetchGapServiceCodes, buildDifficultyAwareWhere } from "../app/api/study/kc/_kc-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_USER = { id: "user-kc", email: "kc@example.com" };
const AUTHED_SESSION = { user: SESSION_USER };

const CERT_PROFILE = {
  certificationPresetId: "preset-1",
  certificationPreset: { id: "preset-1", code: "SAA-C03", name: "AWS Solutions Architect Associate" },
};

function makeKcPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/study/kc/questions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeStatusRequest(requestId: string, topics: string[]): NextRequest {
  const qs = new URLSearchParams({ requestId, topics: topics.join(",") });
  return new NextRequest(`http://localhost/api/study/kc/generate-status?${qs.toString()}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(AUTHED_SESSION);
  mockPrisma.weakAreaReport.findFirst.mockResolvedValue(null);
  mockPrisma.userProfile.findUnique.mockResolvedValue(CERT_PROFILE);
  mockPrisma.studyQuestion.findMany.mockResolvedValue([]);
  mockPrisma.studyQuestion.count.mockResolvedValue(0);
  mockPrisma.workerTrigger.findFirst.mockResolvedValue(null);
  mockPrisma.workerTrigger.create.mockResolvedValue({ id: "trigger-1" });
});

// ---------------------------------------------------------------------------
// TC-001 — fetchGapServiceCodes: gap detection reads latest report
// ---------------------------------------------------------------------------

describe("TC-001 — fetchGapServiceCodes", () => {
  it("returns empty set when no WeakAreaReport exists", async () => {
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue(null);
    const result = await fetchGapServiceCodes("preset-1");
    expect(result.size).toBe(0);
  });

  it("returns empty set when weakAreas is not an array", async () => {
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue({ weakAreas: "not-an-array" });
    const result = await fetchGapServiceCodes("preset-1");
    expect(result.size).toBe(0);
  });

  it("excludes topic-dimension entries (only service dimension matters)", async () => {
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue({
      weakAreas: [
        { dimension: "topic", dimensionId: "EC2", correctRate: 0.3 },
        { dimension: "service", dimensionId: "S3", correctRate: 0.3 },
      ],
    });
    const result = await fetchGapServiceCodes("preset-1");
    expect(result.has("S3")).toBe(true);
    expect(result.has("EC2")).toBe(false);
    expect(result.size).toBe(1);
  });

  it("excludes service entries where correctRate >= 0.6", async () => {
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue({
      weakAreas: [
        { dimension: "service", dimensionId: "EC2", correctRate: 0.7 },
        { dimension: "service", dimensionId: "IAM", correctRate: 0.59 },
      ],
    });
    const result = await fetchGapServiceCodes("preset-1");
    expect(result.has("EC2")).toBe(false);
    expect(result.has("IAM")).toBe(true);
  });

  it("normalises dimensionId to uppercase", async () => {
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue({
      weakAreas: [{ dimension: "service", dimensionId: "ec2", correctRate: 0.4 }],
    });
    const result = await fetchGapServiceCodes("preset-1");
    expect(result.has("EC2")).toBe(true);
    expect(result.has("ec2")).toBe(false);
  });

  it("uses the most recent report (orderBy analyzedAt desc)", async () => {
    // Verify Prisma was called with the right sort order
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue(null);
    await fetchGapServiceCodes("preset-1");

    expect(mockPrisma.weakAreaReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { analyzedAt: "desc" },
        where: { certificationPresetId: "preset-1" },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// TC-002 — buildDifficultyAwareWhere: difficulty per topic class
// ---------------------------------------------------------------------------

describe("TC-002 — buildDifficultyAwareWhere", () => {
  const baseWhere = { active: true, certificationPresetId: "preset-1" };

  it("with empty topics returns base + hard/medium difficulty", () => {
    const result = buildDifficultyAwareWhere([], new Set(), baseWhere);
    expect(result).toMatchObject({ active: true, difficulty: { in: ["hard", "medium"] } });
  });

  it("with all gap topics the OR clause includes nightmare difficulty", () => {
    const result = buildDifficultyAwareWhere(
      ["EC2"],
      new Set(["EC2"]),
      baseWhere,
    );
    const or = result.OR as Array<Record<string, unknown>>;
    expect(or).toBeDefined();
    const nightmareClause = or.find((c) => {
      const d = c.difficulty as { in?: string[] } | undefined;
      return d?.in?.includes("nightmare");
    });
    expect(nightmareClause).toBeDefined();
  });

  it("with all normal topics the OR clause uses hard/medium only", () => {
    const result = buildDifficultyAwareWhere(
      ["S3"],
      new Set(), // no gaps
      baseWhere,
    );
    const or = result.OR as Array<Record<string, unknown>>;
    const hardMediumClause = or.find((c) => {
      const d = c.difficulty as { in?: string[] } | undefined;
      return d?.in?.includes("hard") && d?.in?.includes("medium");
    });
    expect(hardMediumClause).toBeDefined();
    const nightmareClause = or.find((c) => {
      const d = c.difficulty as { in?: string[] } | undefined;
      return d?.in?.includes("nightmare");
    });
    expect(nightmareClause).toBeUndefined();
  });

  it("with mixed topics produces two OR clauses (gap=nightmare, normal=hard/medium)", () => {
    const result = buildDifficultyAwareWhere(
      ["EC2", "S3"],
      new Set(["EC2"]), // EC2 is a gap, S3 is not
      baseWhere,
    );
    const or = result.OR as Array<Record<string, unknown>>;
    expect(or).toHaveLength(2);

    const hasNightmare = or.some((c) => {
      const d = c.difficulty as { in?: string[] } | undefined;
      return d?.in?.includes("nightmare");
    });
    const hasHardMedium = or.some((c) => {
      const d = c.difficulty as { in?: string[] } | undefined;
      return d?.in?.includes("hard") && d?.in?.includes("medium");
    });
    expect(hasNightmare).toBe(true);
    expect(hasHardMedium).toBe(true);
  });

  it("preserves non-OR baseWhere fields", () => {
    const result = buildDifficultyAwareWhere(["EC2"], new Set(["EC2"]), baseWhere);
    expect(result).toMatchObject({ active: true, certificationPresetId: "preset-1" });
  });
});

// ---------------------------------------------------------------------------
// TC-003 — Wizard start gating at the API level
// ---------------------------------------------------------------------------

describe("TC-003 — POST /kc/questions: wizard start gating", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const req = makeKcPostRequest({ topics: ["EC2"], count: 10 });
    const res = await kcQuestionsPost(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when too many topics for the requested count", async () => {
    // count=10 → maxTopics=2; sending 3 topics must be rejected
    const req = makeKcPostRequest({ topics: ["EC2", "S3", "IAM"], count: 10 });
    const res = await kcQuestionsPost(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/maximo 2/i);
  });

  it("returns 400 when user has no certification preset configured", async () => {
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    const req = makeKcPostRequest({ topics: ["EC2"], count: 10 });
    const res = await kcQuestionsPost(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/certificacao/i);
  });
});

// ---------------------------------------------------------------------------
// TC-004 — Empty pool enters 200+insufficient (not 404) so polling begins
// ---------------------------------------------------------------------------

describe("TC-004 — Empty pool returns 200 + insufficient:true", () => {
  it("returns HTTP 200 with questions:[] and insufficient:true when pool is 0", async () => {
    // Pool is empty → triggers generation → must NOT be 404
    mockPrisma.studyQuestion.findMany.mockResolvedValue([]);

    const req = makeKcPostRequest({ topics: ["EC2"], count: 10 });
    const res = await kcQuestionsPost(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { questions: unknown[]; insufficient: boolean; generationRequestId: string };
    expect(body.questions).toEqual([]);
    expect(body.insufficient).toBe(true);
    expect(typeof body.generationRequestId).toBe("string");
    expect(body.generationRequestId.length).toBeGreaterThan(0);
  });

  it("enqueues a WorkerTrigger when the pool is empty", async () => {
    mockPrisma.studyQuestion.findMany.mockResolvedValue([]);

    const req = makeKcPostRequest({ topics: ["EC2"], count: 10 });
    await kcQuestionsPost(req);

    expect(mockPrisma.workerTrigger.create).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// TC-005 — Poll readiness honours difficulty filter
// ---------------------------------------------------------------------------

describe("TC-005 — generate-status uses difficulty-aware count", () => {
  it("filters by difficulty (nightmare for gap topics) when counting", async () => {
    // EC2 is a gap service (correctRate < 0.6)
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue({
      weakAreas: [{ dimension: "service", dimensionId: "EC2", correctRate: 0.4 }],
    });
    mockPrisma.studyQuestion.count.mockResolvedValue(3);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ certificationPresetId: "preset-1" });

    const req = makeStatusRequest("req-abc", ["EC2"]);
    const res = await generateStatusGet(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { count: number };
    expect(body.count).toBe(3);

    // The WHERE passed to count must include the nightmare difficulty for the gap topic
    const callArgs = mockPrisma.studyQuestion.count.mock.calls[0][0] as { where: { OR?: Array<{ difficulty?: { in?: string[] } }> } };
    const or = callArgs.where.OR;
    expect(or).toBeDefined();
    const nightmareIncluded = or!.some((clause) => clause.difficulty?.in?.includes("nightmare"));
    expect(nightmareIncluded).toBe(true);
  });

  it("uses hard/medium for non-gap topics", async () => {
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue(null); // no gaps
    mockPrisma.studyQuestion.count.mockResolvedValue(7);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ certificationPresetId: "preset-1" });

    const req = makeStatusRequest("req-xyz", ["S3"]);
    const res = await generateStatusGet(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { count: number };
    expect(body.count).toBe(7);

    const callArgs = mockPrisma.studyQuestion.count.mock.calls[0][0] as { where: { OR?: Array<{ difficulty?: { in?: string[] } }> } };
    const or = callArgs.where.OR;
    const noNightmare = !or?.some((c) => c.difficulty?.in?.includes("nightmare"));
    expect(noNightmare).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-006 — Timeout fallback and re-fetch failure both recover
// ---------------------------------------------------------------------------

describe("TC-006 — generate-status responds even when pool is empty (TC-006a)", () => {
  it("returns 200 with count:0 when no questions are available (client timeout can proceed)", async () => {
    mockPrisma.studyQuestion.count.mockResolvedValue(0);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ certificationPresetId: "preset-1" });
    mockPrisma.weakAreaReport.findFirst.mockResolvedValue(null);

    const req = makeStatusRequest("req-empty", ["EC2"]);
    const res = await generateStatusGet(req);

    // Must not throw or 5xx — client needs to be able to count to the 90s timeout
    expect(res.status).toBe(200);
    const body = await res.json() as { count: number; jobProcessed: boolean };
    expect(body.count).toBe(0);
    expect(typeof body.jobProcessed).toBe("boolean");
  });
});

describe("TC-006 — createKcQuestions does not throw on 200+insufficient (TC-006b)", () => {
  it("returns result without throwing when route responds with insufficient:true + empty questions", async () => {
    // Mock global fetch to simulate the route response after DEF-003 fix
    const mockResponse = {
      ok: true,
      json: async () => ({
        questions: [],
        insufficient: true,
        generationRequestId: "req-gen-123",
      }),
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse as unknown as Response);

    // Dynamic import avoids running study-api.ts before the fetch spy is in place
    const { createKcQuestions } = await import("@/features/study/services/study-api");

    const result = await createKcQuestions({ topics: ["EC2"], count: 10 });

    expect(result.questions).toEqual([]);
    expect(result.insufficient).toBe(true);
    expect(result.generationRequestId).toBe("req-gen-123");

    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// TC-007 — Multi-topic gap fill covers all services (DEF-002)
// ---------------------------------------------------------------------------

describe("TC-007 — Multi-topic POST enqueues one trigger per service", () => {
  it("creates N WorkerTrigger rows for N selected topics when pool is empty", async () => {
    mockPrisma.studyQuestion.findMany.mockResolvedValue([]);

    const req = makeKcPostRequest({ topics: ["EC2", "S3", "IAM"], count: 15 });
    const res = await kcQuestionsPost(req);

    expect(res.status).toBe(200);

    // One trigger per topic (3 topics → 3 creates)
    expect(mockPrisma.workerTrigger.create).toHaveBeenCalledTimes(3);

    // Each trigger targets a different service code
    const serviceCodes = mockPrisma.workerTrigger.create.mock.calls.map(
      (call: [{ data: { payload: { serviceCode: string } } }]) => call[0].data.payload.serviceCode,
    );
    expect(serviceCodes).toContain("EC2");
    expect(serviceCodes).toContain("S3");
    expect(serviceCodes).toContain("IAM");
  });

  it("all triggers share the same requestId so the client can track them collectively", async () => {
    mockPrisma.studyQuestion.findMany.mockResolvedValue([]);

    const req = makeKcPostRequest({ topics: ["EC2", "S3"], count: 10 });
    const res = await kcQuestionsPost(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { generationRequestId: string };

    const requestIds = mockPrisma.workerTrigger.create.mock.calls.map(
      (call: [{ data: { payload: { requestId: string } } }]) => call[0].data.payload.requestId,
    );
    // Every trigger must carry the same requestId that was returned to the client
    expect(requestIds.every((id: string) => id === body.generationRequestId)).toBe(true);
  });

  it("distributes count evenly across topics", async () => {
    mockPrisma.studyQuestion.findMany.mockResolvedValue([]);

    const req = makeKcPostRequest({ topics: ["EC2", "S3"], count: 10 });
    await kcQuestionsPost(req);

    const counts = mockPrisma.workerTrigger.create.mock.calls.map(
      (call: [{ data: { payload: { count: number } } }]) => call[0].data.payload.count,
    );
    // gap = 10, 2 topics → ceil(10/2) = 5 each
    expect(counts.every((c: number) => c === 5)).toBe(true);
  });
});
