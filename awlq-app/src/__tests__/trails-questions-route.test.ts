/**
 * Regression test: trail quiz generation was failing with
 * "Trails API error 500: Expected ',' or ']' after array element in JSON..."
 * whenever the model returned a malformed/truncated 10-question batch.
 * The route now retries a few times instead of failing on the first bad
 * response — this locks that behavior in.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetSession, mockPrisma, mockCallAI } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockPrisma: {
    questChainStage: { findFirst: vi.fn() },
    userProfile: { findUnique: vi.fn() },
  },
  mockCallAI: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mockGetSession } } }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, callAI: mockCallAI };
});

import { POST } from "@/app/api/trails/[chainId]/stages/[stageId]/questions/route";

const VALID_QUESTIONS_JSON = JSON.stringify({
  questions: [
    {
      statement: "O que e o Amazon S3?",
      options: [
        { key: "A", text: "Fila" },
        { key: "B", text: "Armazenamento de objetos" },
      ],
      correctKey: "B",
      explanation: "S3 e armazenamento de objetos.",
    },
  ],
});

function makeRequest() {
  return new NextRequest("http://localhost/api/trails/chain-1/stages/stage-1/questions", {
    method: "POST",
  });
}

function makeContext() {
  return { params: Promise.resolve({ chainId: "chain-1", stageId: "stage-1" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
  mockPrisma.questChainStage.findFirst.mockResolvedValue({
    title: "S3",
    awsServiceId: "S3",
    topic: null,
    chain: { name: "Trilha AWS", certificationPresetId: null },
  });
  mockPrisma.userProfile.findUnique.mockResolvedValue({ certificationPreset: { name: "SAA-C03" } });
});

describe("POST /api/trails/[chainId]/stages/[stageId]/questions", () => {
  it("retries and succeeds after the model returns malformed JSON once", async () => {
    mockCallAI
      .mockResolvedValueOnce('{"questions": [{"statement": "truncated mid-array",]}')
      .mockResolvedValueOnce(VALID_QUESTIONS_JSON);

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { questions: unknown[] };
    expect(body.questions).toHaveLength(1);
    expect(mockCallAI).toHaveBeenCalledTimes(2);
  });

  it("returns a 500 with a clear message once every retry fails", async () => {
    mockCallAI.mockResolvedValue('{"questions": [{"statement": "still broken",]}');

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(500);
    expect(mockCallAI.mock.calls.length).toBeGreaterThan(1);
  });
});
