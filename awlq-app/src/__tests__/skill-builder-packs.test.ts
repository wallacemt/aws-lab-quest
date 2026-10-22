import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { auth, db } = vi.hoisted(() => ({ auth: vi.fn(), db: {
  userProfile: { findUnique: vi.fn() }, simuladoPack: { findMany: vi.fn() },
} }));
vi.mock("@/lib/user-auth", () => ({ requireApprovedUser: auth }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { GET } from "@/app/api/study/simulado-packs/route";
beforeEach(() => {
  vi.clearAllMocks(); auth.mockResolvedValue({ user: { id: "student" } });
  db.userProfile.findUnique.mockResolvedValue({ certificationPresetId: "cert", certificationPreset: { code: "CLF-C02", name: "Cloud Practitioner" } });
  db.simuladoPack.findMany.mockResolvedValue([{ id: "pack", name: "Practice", isSkillBuilder: true, difficultyScore: 5, createdAt: new Date(), _count: { questions: 20 }, sessions: [] }]);
});
it("filters Skill Builder at the database while preserving active certification scope", async () => {
  const response = await GET(new NextRequest("http://localhost/api/study/simulado-packs?filter=skill-builder"));
  expect(db.simuladoPack.findMany.mock.calls[0][0].where).toEqual({ certificationPresetId: "cert", active: true, isSkillBuilder: true });
  expect((await response.json()).packs[0].isSkillBuilder).toBe(true);
});
it("keeps unmarked packs visible in all mode", async () => {
  await GET(new NextRequest("http://localhost/api/study/simulado-packs?filter=all"));
  expect(db.simuladoPack.findMany.mock.calls[0][0].where).not.toHaveProperty("isSkillBuilder");
});
it("keeps existing done/todo filters", async () => {
  const response = await GET(new NextRequest("http://localhost/api/study/simulado-packs?filter=done"));
  expect((await response.json()).packs).toEqual([]);
});
