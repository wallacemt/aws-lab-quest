/**
 * Flashcard lifecycle test suite — TC-101 through TC-103
 *
 * Test-Report-001 / DEF-005 fix: these replace the "shadow tests" that used
 * to live in retention.test.ts (TC-011/TC-013), which asserted against local
 * reimplementations instead of the real code. Everything here imports and
 * exercises the actual implementation.
 *
 * TC-101: materializeDefaultDeck called twice sequentially on a fresh user
 *         → no duplicate rows.
 * TC-102: materializeDefaultDeck called concurrently (Promise.all) on a
 *         fresh user → still no duplicates (DEF-001 — @@unique([userId,
 *         templateId]) + skipDuplicates: true).
 * TC-103: real PATCH/DELETE route handlers for
 *         /api/retention/flashcards/manage/[flashcardId] — IDOR guard:
 *         404 missing, 403 other-user, 403 not-USER_CREATED, 200 success.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be set up before any module imports)
// ---------------------------------------------------------------------------

const { mockGetSession, mockPrisma } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockPrisma = {
    flashcardTemplate: { findMany: vi.fn() },
    flashcard: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockGetSession, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mockGetSession } } }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ---------------------------------------------------------------------------
// Real implementations under test, imported after the mocks above
// ---------------------------------------------------------------------------

import { materializeDefaultDeck } from "@/lib/flashcard-templates";
import { PATCH, DELETE } from "@/app/api/retention/flashcards/manage/[flashcardId]/route";
import { FlashcardSource } from "@prisma/client";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// TC-101/TC-102: materializeDefaultDeck idempotence
// ---------------------------------------------------------------------------

const USER_ID = "user-fresh";
const TEMPLATES = [
  { id: "tpl-1", awsServiceId: "ec2", topic: "compute", front: "Q1", back: "A1", hint: null },
  { id: "tpl-2", awsServiceId: "s3", topic: "storage", front: "Q2", back: "A2", hint: null },
  { id: "tpl-3", awsServiceId: "iam", topic: "security", front: "Q3", back: "A3", hint: null },
];

/**
 * Backs prisma.flashcard with an in-memory table that actually enforces the
 * @@unique([userId, templateId]) constraint added for DEF-001, so createMany
 * with skipDuplicates: true behaves the way Postgres would: silently drops
 * rows that collide with an existing (userId, templateId) pair. This lets
 * the test prove the real materializeDefaultDeck code path is safe, without
 * depending on a live database connection in the test run.
 */
function installFakeFlashcardStore() {
  const rows: Array<{ userId: string; templateId: string }> = [];

  mockPrisma.flashcardTemplate.findMany.mockResolvedValue(TEMPLATES);

  mockPrisma.flashcard.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) =>
    rows.filter((r) => r.userId === where.userId).map((r) => ({ templateId: r.templateId })),
  );

  mockPrisma.flashcard.createMany.mockImplementation(
    async ({
      data,
      skipDuplicates,
    }: {
      data: Array<{ userId: string; templateId: string }>;
      skipDuplicates?: boolean;
    }) => {
      let count = 0;
      for (const row of data) {
        const isDuplicate = rows.some((r) => r.userId === row.userId && r.templateId === row.templateId);
        if (isDuplicate) {
          if (skipDuplicates) continue;
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        rows.push({ userId: row.userId, templateId: row.templateId });
        count++;
      }
      return { count };
    },
  );

  return rows;
}

describe("TC-101: materializeDefaultDeck — sequential calls don't duplicate", () => {
  it("creates each template once on first call, and nothing more on a second call", async () => {
    const rows = installFakeFlashcardStore();

    await materializeDefaultDeck(USER_ID);
    expect(rows).toHaveLength(TEMPLATES.length);
    expect(mockPrisma.flashcard.createMany).toHaveBeenCalledTimes(1);

    await materializeDefaultDeck(USER_ID);
    expect(rows).toHaveLength(TEMPLATES.length);
    // Second call sees every template already materialized, so it must
    // short-circuit before calling createMany again.
    expect(mockPrisma.flashcard.createMany).toHaveBeenCalledTimes(1);
  });
});

describe("TC-102: materializeDefaultDeck — concurrent calls don't duplicate (DEF-001)", () => {
  it("still produces exactly one row per template when run concurrently for the same user", async () => {
    const rows = installFakeFlashcardStore();

    await Promise.all([materializeDefaultDeck(USER_ID), materializeDefaultDeck(USER_ID)]);

    expect(rows).toHaveLength(TEMPLATES.length);
    const templateIds = rows.map((r) => r.templateId).sort();
    expect(templateIds).toEqual(TEMPLATES.map((t) => t.id).sort());

    // Both racing calls must pass skipDuplicates: true — that's what turns
    // the loser's collision into a no-op instead of a thrown P2002.
    for (const call of mockPrisma.flashcard.createMany.mock.calls) {
      expect(call[0].skipDuplicates).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-103: manage route IDOR guard (real PATCH/DELETE handlers)
// ---------------------------------------------------------------------------

const OWNER_ID = "user-owner";
const OTHER_USER_ID = "user-other";

function makeDeleteRequest(): NextRequest {
  return new NextRequest("http://localhost/api/retention/flashcards/manage/card-1", { method: "DELETE" });
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/retention/flashcards/manage/card-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function paramsFor(flashcardId: string) {
  return { params: Promise.resolve({ flashcardId }) };
}

describe("TC-103: manage route IDOR guard", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } });
  });

  it("returns 404 when the flashcard does not exist", async () => {
    mockPrisma.flashcard.findUnique.mockResolvedValue(null);

    const response = await DELETE(makeDeleteRequest(), paramsFor("missing-card"));

    expect(response.status).toBe(404);
    expect(mockPrisma.flashcard.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when the flashcard belongs to a different user", async () => {
    mockPrisma.flashcard.findUnique.mockResolvedValue({
      userId: OTHER_USER_ID,
      source: FlashcardSource.USER_CREATED,
    });

    const response = await DELETE(makeDeleteRequest(), paramsFor("card-owned-by-other"));

    expect(response.status).toBe(403);
    expect(mockPrisma.flashcard.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when the card is owned but not USER_CREATED (e.g. DEFAULT_DECK)", async () => {
    mockPrisma.flashcard.findUnique.mockResolvedValue({
      userId: OWNER_ID,
      source: FlashcardSource.DEFAULT_DECK,
    });

    const response = await DELETE(makeDeleteRequest(), paramsFor("card-default-deck"));

    expect(response.status).toBe(403);
    expect(mockPrisma.flashcard.delete).not.toHaveBeenCalled();
  });

  it("succeeds (200) when the card is owned and USER_CREATED", async () => {
    mockPrisma.flashcard.findUnique.mockResolvedValue({
      userId: OWNER_ID,
      source: FlashcardSource.USER_CREATED,
    });
    mockPrisma.flashcard.delete.mockResolvedValue({ id: "card-1" });

    const response = await DELETE(makeDeleteRequest(), paramsFor("card-1"));

    expect(response.status).toBe(200);
    expect(mockPrisma.flashcard.delete).toHaveBeenCalledWith({ where: { id: "card-1" } });
  });

  it("PATCH applies the update once ownership passes", async () => {
    mockPrisma.flashcard.findUnique.mockResolvedValue({
      userId: OWNER_ID,
      source: FlashcardSource.USER_CREATED,
    });
    mockPrisma.flashcard.update.mockResolvedValue({ id: "card-1", front: "Updated question" });

    const response = await PATCH(makePatchRequest({ front: "Updated question" }), paramsFor("card-1"));

    expect(response.status).toBe(200);
    expect(mockPrisma.flashcard.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { front: "Updated question" },
    });
  });
});
