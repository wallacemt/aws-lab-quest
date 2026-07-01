/**
 * Mentor Ask test suite — TC-001 through TC-008
 *
 * TC-001: concurrent POSTs — only one 200, rest 429
 * TC-002: sequential second request within 24h → 429
 * TC-003: request after 24h window expires → 200
 * TC-004: Gemini failure after slot reserved → 502; slot consumed (GET shows canAsk:false)
 * TC-005: rolling 24h boundary — 23h blocked, 25h allowed
 * TC-006: input validation — empty, whitespace, 501 chars, missing key, bad JSON → 400, no AI call
 * TC-007: unauthenticated GET + POST → 401
 * TC-008: client askMentorQuestion maps 429 → DailyLimitError; non-JSON 500 → Error (no parse crash)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared before any vi.mock calls
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma, mockModel, mockGetAiModelWithSystem } = vi.hoisted(() => {
  const mockAuth = {
    api: { getSession: vi.fn() },
  };

  const mockPrisma = {
    user: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  // mockModel is shared so TC-004 can override generateContent
  const mockModel = {
    generateContent: vi.fn(),
  };

  const mockGetAiModelWithSystem = vi.fn().mockReturnValue(mockModel);

  return { mockAuth, mockPrisma, mockModel, mockGetAiModelWithSystem };
});

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai", () => ({ getAiModelWithSystem: mockGetAiModelWithSystem }));

// ---------------------------------------------------------------------------
// Route handlers imported AFTER mocks are registered
// ---------------------------------------------------------------------------

import { GET, POST } from "@/app/api/mentor/ask/route";
import { askMentorQuestion, DailyLimitError } from "@/features/mentor/services/mentor-api";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SESSION_USER = { id: "user-mentor", email: "mentor@example.com" };
const HOUR_MS = 60 * 60 * 1000;

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/mentor/ask", { method: "GET" });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mentor/ask", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();

  // Default happy path
  mockAuth.api.getSession.mockResolvedValue({ user: SESSION_USER });
  mockModel.generateContent.mockResolvedValue({
    response: { text: () => "AWS é incrível!" },
  });
  // Default: slot available (updateMany finds the user and updates)
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.user.update.mockResolvedValue({});
  // Default: last question was 25h ago — outside the rolling window
  mockPrisma.user.findUnique.mockResolvedValue({
    lastMentorQuestionAt: new Date(Date.now() - 25 * HOUR_MS),
    lastMentorQuestion: null,
    lastMentorAnswer: null,
  });
});

// ---------------------------------------------------------------------------
// TC-001: Concurrent POSTs — atomic reservation ensures only one succeeds
// ---------------------------------------------------------------------------

describe("TC-001: Concurrent POSTs — only one slot reserved", () => {
  it("returns exactly one 200 and one 429 when two requests race", async () => {
    // Simulate DB atomicity: first updateMany wins (count:1), second loses (count:0)
    mockPrisma.user.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    // When the loser calls findUnique to get resetsAt, return a recent timestamp
    mockPrisma.user.findUnique.mockResolvedValue({
      lastMentorQuestionAt: new Date(),
    });

    const [r1, r2] = await Promise.all([
      POST(makePostRequest({ question: "O que é S3?" })),
      POST(makePostRequest({ question: "O que é EC2?" })),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 429]);
  });

  it("the 429 response includes daily_limit error and a resetsAt timestamp", async () => {
    mockPrisma.user.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const fixedTime = new Date();
    mockPrisma.user.findUnique.mockResolvedValue({
      lastMentorQuestionAt: fixedTime,
    });

    const responses = await Promise.all([
      POST(makePostRequest({ question: "Q1" })),
      POST(makePostRequest({ question: "Q2" })),
    ]);

    const r429 = responses.find((r) => r.status === 429)!;
    const body = (await r429.json()) as { error: string; resetsAt: string };
    expect(body.error).toBe("daily_limit");
    expect(typeof body.resetsAt).toBe("string");
    // resetsAt should be approximately fixedTime + 24h
    const expectedResetMs = fixedTime.getTime() + 24 * HOUR_MS;
    expect(new Date(body.resetsAt).getTime()).toBeCloseTo(expectedResetMs, -3);
  });
});

// ---------------------------------------------------------------------------
// TC-002: Sequential second request within 24h window → 429
// ---------------------------------------------------------------------------

describe("TC-002: Sequential second request within 24h → 429", () => {
  it("first request succeeds, second request within window returns 429", async () => {
    // First POST: slot available
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
    const r1 = await POST(makePostRequest({ question: "Primeira pergunta?" }));
    expect(r1.status).toBe(200);

    // Second POST: slot already taken
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue({
      lastMentorQuestionAt: new Date(),
    });

    const r2 = await POST(makePostRequest({ question: "Segunda pergunta?" }));
    expect(r2.status).toBe(429);

    const body = (await r2.json()) as { error: string; resetsAt: string };
    expect(body.error).toBe("daily_limit");
    expect(typeof body.resetsAt).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// TC-003: Request after 24h window expires → 200
// ---------------------------------------------------------------------------

describe("TC-003: Request after 24h window has expired → 200", () => {
  it("allows a question when last asked more than 24h ago", async () => {
    // updateMany returns count:1 because the WHERE condition matches
    // (lastMentorQuestionAt is older than cutoff)
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makePostRequest({ question: "O que é VPC?" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { answer: string; resetsAt: string };
    expect(typeof body.answer).toBe("string");
    expect(typeof body.resetsAt).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// TC-004: Gemini failure after slot reserved → 502; slot is RELEASED (restored)
// ---------------------------------------------------------------------------

describe("TC-004: AI failure after slot reserved", () => {
  it("returns 502 when Gemini throws after the slot was reserved", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ lastMentorQuestionAt: null });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    mockModel.generateContent.mockRejectedValueOnce(new Error("Gemini overloaded"));

    const res = await POST(makePostRequest({ question: "Pergunta que vai falhar?" }));

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Falha ao contatar o Mestre");
  });

  it("restores the previous slot value after an AI failure so the user can retry", async () => {
    const previousValue = null;
    mockPrisma.user.findUnique.mockResolvedValue({ lastMentorQuestionAt: previousValue });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    mockModel.generateContent.mockRejectedValueOnce(new Error("Gemini overloaded"));

    await POST(makePostRequest({ question: "Pergunta que vai falhar?" }));

    // The restore call must have been made with the previous value
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lastMentorQuestionAt: previousValue },
      }),
    );
  });

  it("GET shows canAsk:true after a failed POST (slot restored)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ lastMentorQuestionAt: null });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    mockModel.generateContent.mockRejectedValueOnce(new Error("Gemini overloaded"));

    await POST(makePostRequest({ question: "Pergunta que vai falhar?" }));

    // After the failed POST the slot was restored to null — user can ask again.
    mockPrisma.user.findUnique.mockResolvedValue({ lastMentorQuestionAt: null });

    const getRes = await GET(makeGetRequest());
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { canAsk: boolean; resetsAt: string | null };
    expect(body.canAsk).toBe(true);
    expect(body.resetsAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TC-005: Rolling 24h boundary — 23h blocked, 25h allowed
// ---------------------------------------------------------------------------

describe("TC-005: Rolling 24h boundary via GET endpoint", () => {
  it("canAsk:false when lastMentorQuestionAt is 23h ago", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      lastMentorQuestionAt: new Date(Date.now() - 23 * HOUR_MS),
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { canAsk: boolean; resetsAt: string | null };
    expect(body.canAsk).toBe(false);
    expect(typeof body.resetsAt).toBe("string");
  });

  it("canAsk:true when lastMentorQuestionAt is 25h ago", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      lastMentorQuestionAt: new Date(Date.now() - 25 * HOUR_MS),
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { canAsk: boolean; resetsAt: string | null };
    expect(body.canAsk).toBe(true);
    expect(body.resetsAt).toBeNull();
  });

  it("canAsk:true when lastMentorQuestionAt is null (first-time user)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ lastMentorQuestionAt: null });

    const res = await GET(makeGetRequest());
    const body = (await res.json()) as { canAsk: boolean };
    expect(body.canAsk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-006: Input validation — 400 for all invalid inputs; no AI or DB slot call
// ---------------------------------------------------------------------------

describe("TC-006: Input validation → 400, no Gemini call, no slot consumed", () => {
  it("returns 400 for empty question string", async () => {
    const res = await POST(makePostRequest({ question: "" }));
    expect(res.status).toBe(400);
    expect(mockModel.generateContent).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 for whitespace-only question", async () => {
    const res = await POST(makePostRequest({ question: "   " }));
    expect(res.status).toBe(400);
    expect(mockModel.generateContent).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 for question longer than 500 characters", async () => {
    const res = await POST(makePostRequest({ question: "a".repeat(501) }));
    expect(res.status).toBe(400);
    expect(mockModel.generateContent).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when question key is missing from body", async () => {
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
    expect(mockModel.generateContent).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/mentor/ask", {
      method: "POST",
      body: "not-valid-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockModel.generateContent).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("accepts a question of exactly 500 characters (boundary)", async () => {
    const res = await POST(makePostRequest({ question: "a".repeat(500) }));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// TC-007: Unauthenticated requests → 401
// ---------------------------------------------------------------------------

describe("TC-007: Unauthenticated requests → 401", () => {
  it("GET returns 401 without a session", async () => {
    mockAuth.api.getSession.mockResolvedValueOnce(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("POST returns 401 without a session", async () => {
    mockAuth.api.getSession.mockResolvedValueOnce(null);
    const res = await POST(makePostRequest({ question: "Teste?" }));
    expect(res.status).toBe(401);
    // No DB or AI should be touched
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    expect(mockModel.generateContent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// TC-008: Client askMentorQuestion — error mapping
// ---------------------------------------------------------------------------

describe("TC-008: Client askMentorQuestion error mapping", () => {
  it("throws DailyLimitError with correct resetsAt for 429 response", async () => {
    const resetsAt = new Date(Date.now() + 24 * HOUR_MS).toISOString();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
        text: async () => JSON.stringify({ resetsAt }),
      }),
    );

    const err = await askMentorQuestion("Teste").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DailyLimitError);
    expect((err as DailyLimitError).resetsAt).toBe(resetsAt);
  });

  it("throws Error (not SyntaxError) for a non-JSON 500 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        // Simulate HTML/plaintext error body — no json() method returning parseable data
        text: async () => "Internal Server Error",
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }),
    );

    const err = await askMentorQuestion("Teste").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(SyntaxError);
    expect((err as Error).message).toContain("500");
  });
});
