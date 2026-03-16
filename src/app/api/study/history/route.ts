import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuestionOptionMapping } from "@/lib/types";

type StudyHistoryItem = {
  questionId: string;
  statement: string;
  selectedOption: string;
  correctOption: string;
  options: Record<string, string>;
  explanations: Record<string, string>;
  optionMapping?: QuestionOptionMapping;
};

type Body = {
  sessionType?: "KC" | "SIMULADO";
  title?: string;
  certificationCode?: string;
  gainedXp?: number;
  scorePercent?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  durationSeconds?: number;
  answersSnapshot?: StudyHistoryItem[];
};

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = await prisma.studySessionHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;

  if (
    !body.sessionType ||
    !body.title ||
    body.scorePercent == null ||
    body.correctAnswers == null ||
    body.totalQuestions == null
  ) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const snapshot = Array.isArray(body.answersSnapshot) ? body.answersSnapshot.slice(0, 120) : [];

  const item = await prisma.studySessionHistory.create({
    data: {
      userId: session.user.id,
      sessionType: body.sessionType,
      title: body.title,
      certificationCode: body.certificationCode ?? null,
      gainedXp: Math.max(0, Math.round(body.gainedXp ?? 0)),
      scorePercent: Math.max(0, Math.min(100, Math.round(body.scorePercent))),
      correctAnswers: Math.max(0, Math.round(body.correctAnswers)),
      totalQuestions: Math.max(1, Math.round(body.totalQuestions)),
      durationSeconds: body.durationSeconds == null ? null : Math.max(0, Math.round(body.durationSeconds)),
      answersSnapshot: snapshot,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
