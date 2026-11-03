import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { requireApproved, requireAdmin, db, mockRedis, mockScanKeys } = vi.hoisted(() => ({
  requireApproved: vi.fn(),
  requireAdmin: vi.fn(),
  db: {
    userProfile: { findUnique: vi.fn() },
    certificationPreset: { findFirst: vi.fn() },
    simuladoPack: { findMany: vi.fn() },
    session: { groupBy: vi.fn() },
    user: { count: vi.fn(), findUnique: vi.fn() },
  },
  mockRedis: { mget: vi.fn() },
  mockScanKeys: vi.fn(),
}));

vi.mock("@/lib/user-auth", () => ({ requireApprovedUser: requireApproved }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/redis", () => ({ redis: mockRedis, scanKeys: mockScanKeys }));

import { GET as getPacks } from "@/app/api/study/simulado-packs/route";
import { GET as getOnlineCount } from "@/app/api/online/count/route";
import { GET as getGuests } from "@/app/api/admin/guests/route";
import { getSimuladoDifficulty } from "@/lib/simulado-difficulty";

const request = (url: string) => new NextRequest(`http://localhost${url}`);

beforeEach(() => {
  vi.clearAllMocks();
  requireApproved.mockResolvedValue({ user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) });
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin", email: "admin@test", role: "admin" });
  db.certificationPreset.findFirst.mockResolvedValue({ id: "cert", code: "CLF-C02", name: "Cloud Practitioner", examMinutes: 90, passingScorePercent: 70 });
  db.simuladoPack.findMany.mockResolvedValue([{ id: "pack", name: "Practice", isSkillBuilder: false, artworkUrl: null, difficultyScore: 2, createdAt: new Date(), _count: { questions: 10 } }]);
  db.session.groupBy.mockResolvedValue([]);
  db.user.count.mockResolvedValue(0);
});

describe("guest features", () => {
  it("loads guest packs by active certification without session history", async () => {
    const response = await getPacks(request("/api/study/simulado-packs?certCode=CLF-C02"));
    const body = await response.json();
    expect(body.certificationCode).toBe("CLF-C02");
    expect(body.packs[0]).toMatchObject({ attempts: 0, bestScore: null, lastSessionId: null, sessions: [] });
  });

  it("returns empty packs without guest certCode", async () => {
    const body = await (await getPacks(request("/api/study/simulado-packs"))).json();
    expect(body).toMatchObject({ packs: [], certificationCode: null, certificationName: null, passingScorePercent: null });
  });

  it("preserves forbidden status for pending users", async () => {
    requireApproved.mockResolvedValueOnce({ user: null, response: Response.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await getPacks(request("/api/study/simulado-packs?certCode=CLF-C02"))).status).toBe(403);
  });

  it("adds live guests to online count", async () => {
    mockScanKeys.mockResolvedValue(["online:guest:a", "online:guest:b"]);
    const body = await (await getOnlineCount()).json();
    expect(body).toMatchObject({ onlineCount: 2, guestCount: 2 });
  });

  it("requires admin and returns Redis guests", async () => {
    mockScanKeys.mockResolvedValue(["online:guest:a"]);
    mockRedis.mget.mockResolvedValue([JSON.stringify({ displayName: "Convidado-abc123", lastSeen: "2026-11-03T00:00:00.000Z" })]);
    const body = await (await getGuests(request("/api/admin/guests"))).json();
    expect(body.guests[0]).toMatchObject({ guestSessionId: "a", displayName: "Convidado-abc123" });
    requireAdmin.mockResolvedValueOnce({ ok: false, response: Response.json({}, { status: 401 }) });
    expect((await getGuests(request("/api/admin/guests"))).status).toBe(401);
  });

  it("maps difficulty scores to three labels", () => {
    expect(getSimuladoDifficulty(1)).toBe("easy");
    expect(getSimuladoDifficulty(3)).toBe("medium");
    expect(getSimuladoDifficulty(5)).toBe("hard");
  });
});
