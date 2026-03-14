import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapDbQuestionToStudyQuestion, pickRandomItems } from "@/lib/study-questions";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

type Body = {
  topics?: string[];
  difficulties?: string[];
  count?: number;
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const topics = (body.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const difficulties = (body.difficulties ?? []).filter((value) => VALID_DIFFICULTIES.has(value));
  const count = Math.max(1, Math.min(20, Number(body.count ?? 10)));

  const questions = await prisma.studyQuestion.findMany({
    where: {
      active: true,
      usage: { in: ["KC", "BOTH"] },
      ...(topics.length > 0 ? { awsService: { code: { in: topics } } } : {}),
      ...(difficulties.length > 0 ? { difficulty: { in: difficulties as Array<"easy" | "medium" | "hard"> } } : {}),
    },
    include: {
      certificationPreset: { select: { code: true } },
      awsService: { select: { code: true, name: true } },
    },
    take: 200,
  });

  if (questions.length === 0) {
    return NextResponse.json({ error: "Nenhuma questao encontrada para os filtros selecionados." }, { status: 404 });
  }

  const selected = pickRandomItems(questions, count).map(mapDbQuestionToStudyQuestion);
  return NextResponse.json({ questions: selected });
}
