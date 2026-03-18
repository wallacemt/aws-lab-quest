import { NextRequest, NextResponse } from "next/server";
import { syncUserAchievements } from "@/lib/achievements";
import { auth } from "@/lib/auth";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { prisma } from "@/lib/prisma";
import { publishLeaderboardUpdatedEvent } from "@/lib/realtime-events";
import { QuestionOptionMapping } from "@/lib/types";
import { applyWeightedXp, listXpWeightsByActivity, resolveXpWeight, XpActivityType } from "@/lib/xp-weights";

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

function toTaskDifficulty(value: string | undefined): "easy" | "medium" | "hard" {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }
  return "medium";
}

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

  let computedXp = Math.max(0, Math.round(body.gainedXp ?? 0));
  if (snapshot.length > 0) {
    const questionIds = snapshot
      .map((item) => item.questionId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const uniqueIds = Array.from(new Set(questionIds)).slice(0, 200);

    if (uniqueIds.length > 0) {
      const [questions, weights] = await Promise.all([
        prisma.studyQuestion.findMany({
          where: { id: { in: uniqueIds } },
          select: {
            id: true,
            topic: true,
            difficulty: true,
          },
        }),
        listXpWeightsByActivity(body.sessionType),
      ]);

      const questionMap = new Map(questions.map((question) => [question.id, question]));

      computedXp = snapshot.reduce((total, answer) => {
        if (answer.selectedOption !== answer.correctOption) {
          return total;
        }

        const question = questionMap.get(answer.questionId);
        const difficulty = toTaskDifficulty(question?.difficulty);
        const topic = question?.topic ?? "*";

        const basePerCorrect = Math.max(20, Math.round(getTaskXpByDifficulty(difficulty) / 4));
        const resolvedWeight = resolveXpWeight(weights, {
          activityType: body.sessionType as XpActivityType,
          topic,
          difficulty,
        });

        return total + applyWeightedXp(basePerCorrect, resolvedWeight);
      }, 0);
    }
  }

  const item = await prisma.studySessionHistory.create({
    data: {
      userId: session.user.id,
      sessionType: body.sessionType,
      title: body.title,
      certificationCode: body.certificationCode ?? null,
      gainedXp: computedXp,
      scorePercent: Math.max(0, Math.min(100, Math.round(body.scorePercent))),
      correctAnswers: Math.max(0, Math.round(body.correctAnswers)),
      totalQuestions: Math.max(1, Math.round(body.totalQuestions)),
      durationSeconds: body.durationSeconds == null ? null : Math.max(0, Math.round(body.durationSeconds)),
      answersSnapshot: snapshot,
      completedAt: new Date(),
    },
  });

  void publishLeaderboardUpdatedEvent({
    userId: session.user.id,
    source: body.sessionType,
    gainedXp: item.gainedXp,
  });
  void syncUserAchievements(session.user.id);

  return NextResponse.json({ item }, { status: 201 });
}
