import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { searchParams } = new URL(request.url);
  const certificationCode = searchParams.get("certificationCode");
  const search = searchParams.get("search")?.trim() ?? "";
  const difficulty = searchParams.get("difficulty") ?? "";
  const topic = searchParams.get("topic")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "30", 10)));

  if (!certificationCode) {
    return NextResponse.json({ error: "certificationCode obrigatorio" }, { status: 400 });
  }

  const certPreset = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode },
    select: { id: true },
  });
  if (!certPreset) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const alreadyInPack = await prisma.simuladoPackQuestion.findMany({
    where: { pack: { certificationPresetId: certPreset.id, active: true } },
    select: { questionId: true },
  });
  const usedIds = alreadyInPack.map((r) => r.questionId);

  const where: Prisma.StudyQuestionWhereInput = {
    certificationPresetId: certPreset.id,
    active: true,
    usage: { in: ["SIMULADO", "BOTH"] },
    id: { notIn: usedIds },
    ...(difficulty ? { difficulty: difficulty as "easy" | "medium" | "hard" } : {}),
    ...(search ? { statement: { contains: search, mode: "insensitive" } } : {}),
    ...(topic ? { topic: { contains: topic, mode: "insensitive" as const } } : {}),
  };

  const [total, questions] = await Promise.all([
    prisma.studyQuestion.count({ where }),
    prisma.studyQuestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        statement: true,
        topic: true,
        difficulty: true,
        questionType: true,
        createdAt: true,
      },
    }),
  ]);

  const items = questions.map((q) => ({
    ...q,
    statement: q.statement.length > 120 ? q.statement.slice(0, 120) + "..." : q.statement,
  }));

  return NextResponse.json({ items, total, page, pageSize });
}
