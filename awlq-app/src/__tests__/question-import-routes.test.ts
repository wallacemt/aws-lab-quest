import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { admin, db } = vi.hoisted(() => ({ admin: vi.fn(), db: {
  certificationPreset: { findMany: vi.fn(), findUnique: vi.fn() },
  awsService: { findMany: vi.fn() },
  studyQuestion: { create: vi.fn(), count: vi.fn() },
  questionAwsService: { createMany: vi.fn() },
  simuladoPack: { create: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: admin }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/simulado-pack-artwork", () => ({ resolveArtworkForStorage: vi.fn().mockResolvedValue(null), deleteArtworkFromSupabase: vi.fn() }));
import { POST as importQuestions } from "@/app/api/admin/questions/import-json/route";
import { POST as createPack } from "@/app/api/admin/simulado-packs/route";
const q = { statement: "Service?", options: { A: "S3", B: "EC2" }, correctOption: "A", certificationCode: "OTHER" };
const questions = Array.from({ length: 20 }, (_, i) => ({ ...q, statement: `Question ${i}` }));
const req = (body: unknown) => new NextRequest("http://localhost/api/admin/import", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  admin.mockResolvedValue({ ok: true, userId: "admin" });
  db.certificationPreset.findMany.mockResolvedValue([{ id: "cert", code: "CLF-C02" }]);
  db.certificationPreset.findUnique.mockResolvedValue({ id: "cert" });
  db.awsService.findMany.mockResolvedValue([]);
  db.studyQuestion.create.mockImplementation(async () => ({ id: `q-${db.studyQuestion.create.mock.calls.length}` }));
  db.simuladoPack.create.mockResolvedValue({ id: "pack", name: "Practice" });
  db.$transaction.mockImplementation(async callback => callback(db));
});
describe("question import and maker", () => {
  it.each([importQuestions, createPack])("requires admin before processing", async handler => {
    admin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await handler(req({}))).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("previews without writing and rejects unknown certifications", async () => {
    const res = await importQuestions(req({ questions: [{ ...q, certificationCode: "CLF-C02" }], dryRun: true }));
    expect(res.status).toBe(200); expect(db.$transaction).not.toHaveBeenCalled();
    expect((await importQuestions(req({ questions: [q] }))).status).toBe(422);
  });
  it("validates all items before writes", async () => {
    expect((await importQuestions(req({ questions: [{ ...q, certificationCode: "CLF-C02" }, null] }))).status).toBe(422);
    expect(db.studyQuestion.create).not.toHaveBeenCalled();
  });
  it("uses a single transaction for bank import", async () => {
    const res = await importQuestions(req({ questions: [{ ...q, certificationCode: "CLF-C02" }] }));
    expect(res.status).toBe(201); expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it("creates a pack solely from JSON and forces its certification on every imported question", async () => {
    const res = await createPack(req({ name: "Practice", certificationCode: "CLF-C02", questions, isSkillBuilder: true }));
    expect(res.status).toBe(201); expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.studyQuestion.create).toHaveBeenCalledTimes(20);
    for (const [args] of db.studyQuestion.create.mock.calls) expect(args.data.certificationPresetId).toBe("cert");
    const data = db.simuladoPack.create.mock.calls[0][0].data;
    expect(data.isSkillBuilder).toBe(true); expect(data.questionCount).toBe(20);
    expect(data.questions.create).toHaveLength(20);
    expect(data.questions.create[19]).toEqual({ questionId: "q-20", position: 19 });
  });
  it("propagates failure from the shared transaction instead of reporting success", async () => {
    db.simuladoPack.create.mockRejectedValueOnce(new Error("database failure"));
    await expect(createPack(req({ name: "Practice", certificationCode: "CLF-C02", questions }))).rejects.toThrow("database failure");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it.each([
    { questions: questions.slice(0, 19) }, { questions: Array(66).fill(q) },
    { questions, questionIds: ["id"] }, { questions, isSkillBuilder: "true" },
    { questions: [null] }, { questionIds: Array(20).fill("same") },
  ])("rejects invalid pack payload before writing: %j", async fields => {
    const res = await createPack(req({ name: "Practice", certificationCode: "CLF-C02", ...fields }));
    expect(res.status).toBeGreaterThanOrEqual(400); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("preserves existing question selection and defaults provenance to false", async () => {
    db.studyQuestion.count.mockResolvedValue(20);
    const questionIds = Array.from({ length: 20 }, (_, i) => `existing-${i}`);
    const res = await createPack(req({ name: "Practice", certificationCode: "CLF-C02", questionIds }));
    expect(res.status).toBe(201); expect(db.studyQuestion.create).not.toHaveBeenCalled();
    expect(db.simuladoPack.create.mock.calls[0][0].data.isSkillBuilder).toBe(false);
  });
  it("rejects questions from a different certification", async () => {
    db.studyQuestion.count.mockResolvedValue(19);
    const res = await createPack(req({ name: "Practice", certificationCode: "CLF-C02", questionIds: Array.from({ length: 20 }, (_, i) => `q-${i}`) }));
    expect(res.status).toBe(422); expect(db.$transaction).not.toHaveBeenCalled();
  });
});
