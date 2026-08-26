/**
 * AI content-suggestion engine tests (Epic #60).
 *
 * Covers the shared `requestAiCandidates`/`aiSuggestionErrorResponse` helper
 * (retry on malformed JSON, giving up after maxAttempts, 503 vs 502 mapping)
 * and the auth gate + happy path for each new "Sugerir com IA" admin route
 * (trails, arena bosses, weekly challenge).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockCallAI, mockRequireAdmin, mockPrisma, MockAiNotConfiguredError } = vi.hoisted(() => {
  const mockCallAI = vi.fn();
  const mockRequireAdmin = vi.fn();
  const mockPrisma = {
    questChain: { findMany: vi.fn().mockResolvedValue([]) },
    certificationPreset: { findMany: vi.fn().mockResolvedValue([]) },
    boss: { findMany: vi.fn().mockResolvedValue([]) },
    awsService: { findMany: vi.fn().mockResolvedValue([]) },
    weeklyChallenge: { findMany: vi.fn().mockResolvedValue([]) },
  };
  class MockAiNotConfiguredError extends Error {
    constructor() {
      super("IA nao configurada.");
      this.name = "AiNotConfiguredError";
    }
  }
  return { mockCallAI, mockRequireAdmin, mockPrisma, MockAiNotConfiguredError };
});

vi.mock("@/lib/ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
  return {
    ...actual,
    callAI: mockCallAI,
    AiNotConfiguredError: MockAiNotConfiguredError,
  };
});
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { requestAiCandidates, aiSuggestionErrorResponse } from "@/lib/ai-suggestion";
import { POST as suggestTrail } from "@/app/api/admin/trails/suggest/route";
import { POST as suggestBoss } from "@/app/api/admin/arena/bosses/suggest/route";
import { POST as suggestWeeklyChallenge } from "@/app/api/admin/weekly-challenge/suggest/route";

const ADMIN_OK = { ok: true as const, userId: "admin-1", email: "admin@test.com", role: "admin" };
const NOT_ADMIN = {
  ok: false as const,
  response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
};

function makeRequest(url: string, body: unknown = { count: 1 }) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(ADMIN_OK);
});

describe("requestAiCandidates", () => {
  it("returns parsed candidates on the first successful attempt", async () => {
    mockCallAI.mockResolvedValue('{"candidates":[{"foo":"bar"}]}');

    const result = await requestAiCandidates({
      context: "TRAIL_SUGGESTION",
      prompt: "prompt",
      parseCandidates: (parsed) => (parsed as { candidates: unknown[] }).candidates,
    });

    expect(result).toEqual([{ foo: "bar" }]);
    expect(mockCallAI).toHaveBeenCalledTimes(1);
  });

  it("retries on malformed JSON and succeeds on a later attempt", async () => {
    mockCallAI
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce('{"candidates":[{"foo":"bar"}]}');

    const result = await requestAiCandidates({
      context: "TRAIL_SUGGESTION",
      prompt: "prompt",
      parseCandidates: (parsed) => (parsed as { candidates: unknown[] }).candidates,
    });

    expect(result).toEqual([{ foo: "bar" }]);
    expect(mockCallAI).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting maxAttempts", async () => {
    mockCallAI.mockResolvedValue("not json at all");

    await expect(
      requestAiCandidates({
        context: "TRAIL_SUGGESTION",
        prompt: "prompt",
        parseCandidates: () => [],
        maxAttempts: 2,
      }),
    ).rejects.toThrow();
    expect(mockCallAI).toHaveBeenCalledTimes(2);
  });

  it("throws when every candidate fails validation", async () => {
    mockCallAI.mockResolvedValue('{"candidates":[{"foo":"bar"}]}');

    await expect(
      requestAiCandidates({
        context: "TRAIL_SUGGESTION",
        prompt: "prompt",
        parseCandidates: () => [],
        maxAttempts: 1,
      }),
    ).rejects.toThrow();
  });
});

describe("aiSuggestionErrorResponse", () => {
  it("maps AiNotConfiguredError to 503", async () => {
    const res = aiSuggestionErrorResponse(new MockAiNotConfiguredError());
    expect(res.status).toBe(503);
  });

  it("maps any other error to 502", async () => {
    const res = aiSuggestionErrorResponse(new Error("boom"));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("boom");
  });
});

describe("POST /api/admin/trails/suggest", () => {
  it("returns 403 without an admin session", async () => {
    mockRequireAdmin.mockResolvedValue(NOT_ADMIN);
    const res = await suggestTrail(makeRequest("http://localhost/api/admin/trails/suggest"));
    expect(res.status).toBe(403);
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it("returns sanitized candidates, resolving certificationCode to an id", async () => {
    mockPrisma.certificationPreset.findMany.mockResolvedValue([
      { id: "cert-1", code: "SAA-C03", name: "Solutions Architect Associate" },
    ]);
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        candidates: [
          { name: "Trilha SAA", description: "Foco em arquitetura.", certificationCode: "SAA-C03" },
        ],
      }),
    );

    const res = await suggestTrail(makeRequest("http://localhost/api/admin/trails/suggest"));
    const body = (await res.json()) as { candidates: { certificationPresetId: string | null }[] };

    expect(res.status).toBe(200);
    expect(body.candidates).toEqual([
      { name: "Trilha SAA", description: "Foco em arquitetura.", certificationPresetId: "cert-1", stages: [] },
    ]);
  });

  it("keeps a known awsServiceCode as-is, discards an unknown one, drops unlockRule with an unknown sessionType, and discards titleless stages", async () => {
    mockPrisma.certificationPreset.findMany.mockResolvedValue([]);
    mockPrisma.awsService.findMany.mockResolvedValue([{ code: "EC2", name: "Amazon EC2" }]);
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        candidates: [
          {
            name: "Trilha EC2",
            description: "Foco em EC2.",
            certificationCode: null,
            stages: [
              { title: "Fundamentos", topic: null, awsServiceCode: "EC2", unlockRule: null },
              {
                title: "Avancado",
                awsServiceCode: "EC2",
                unlockRule: { sessionType: "KC", minScorePercent: 70 },
              },
              {
                title: "Invalido",
                awsServiceCode: "NOT_A_SERVICE",
                unlockRule: { sessionType: "BOGUS", minScorePercent: 70 },
              },
              { topic: "sem titulo" },
            ],
          },
        ],
      }),
    );

    const res = await suggestTrail(makeRequest("http://localhost/api/admin/trails/suggest"));
    const body = (await res.json()) as { candidates: { stages: unknown[] }[] };

    expect(res.status).toBe(200);
    expect(body.candidates[0].stages).toEqual([
      { title: "Fundamentos", topic: null, awsServiceId: "EC2", unlockRule: null },
      { title: "Avancado", topic: null, awsServiceId: "EC2", unlockRule: { sessionType: "KC", minScorePercent: 70 } },
      { title: "Invalido", topic: null, awsServiceId: null, unlockRule: null },
    ]);
  });

  it("returns 503 when the AI is not configured", async () => {
    mockCallAI.mockRejectedValue(new MockAiNotConfiguredError());
    const res = await suggestTrail(makeRequest("http://localhost/api/admin/trails/suggest"));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/admin/arena/bosses/suggest", () => {
  it("returns 403 without an admin session", async () => {
    mockRequireAdmin.mockResolvedValue(NOT_ADMIN);
    const res = await suggestBoss(makeRequest("http://localhost/api/admin/arena/bosses/suggest"));
    expect(res.status).toBe(403);
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it("discards a candidate whose themeService is not a known AWS service code", async () => {
    mockPrisma.awsService.findMany.mockResolvedValue([{ code: "EC2", name: "Amazon EC2" }]);
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        candidates: [
          { name: "Boss valido", code: "boss_ec2", themeService: "EC2", maxHp: 1200, damagePerCorrect: 20 },
          { name: "Boss invalido", code: "boss_bad", themeService: "NOT_A_SERVICE" },
        ],
      }),
    );

    const res = await suggestBoss(makeRequest("http://localhost/api/admin/arena/bosses/suggest"));
    const body = (await res.json()) as { candidates: unknown[] };

    expect(res.status).toBe(200);
    expect(body.candidates).toEqual([
      { name: "Boss valido", code: "boss_ec2", themeService: "EC2", maxHp: 1200, damagePerCorrect: 20 },
    ]);
  });
});

describe("POST /api/admin/weekly-challenge/suggest", () => {
  it("returns 403 without an admin session", async () => {
    mockRequireAdmin.mockResolvedValue(NOT_ADMIN);
    const res = await suggestWeeklyChallenge(makeRequest("http://localhost/api/admin/weekly-challenge/suggest"));
    expect(res.status).toBe(403);
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it("returns sanitized title candidates", async () => {
    mockCallAI.mockResolvedValue(JSON.stringify({ candidates: [{ title: "Semana da IAM" }, { title: "  " }] }));

    const res = await suggestWeeklyChallenge(makeRequest("http://localhost/api/admin/weekly-challenge/suggest"));
    const body = (await res.json()) as { candidates: { title: string }[] };

    expect(res.status).toBe(200);
    expect(body.candidates).toEqual([{ title: "Semana da IAM" }]);
  });
});
