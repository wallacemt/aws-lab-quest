import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCorrectAnswer, normalizeQuestionType } from "@/lib/study-answer-utils";

type SnapshotAnswer = {
  questionId?: unknown;
  questionType?: unknown;
  selectedOption?: unknown;
  selectedOptions?: unknown;
  correctOption?: unknown;
  correctOptions?: unknown;
};

type WeakServiceStat = {
  topic: string;
  serviceCode: string;
  serviceName: string;
  attempts: number;
  errors: number;
  correct: number;
  errorRate: number;
};

function toSnapshotAnswers(value: unknown): SnapshotAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as SnapshotAnswer[];
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const take = Math.max(1, Math.min(20, Number(searchParams.get("take") ?? 10)));
  const sampleSessions = Math.max(5, Math.min(80, Number(searchParams.get("sample") ?? 35)));

  const history = await prisma.studySessionHistory.findMany({
    where: {
      userId: session.user.id,
      sessionType: "SIMULADO",
    },
    orderBy: { completedAt: "desc" },
    take: sampleSessions,
    select: {
      completedAt: true,
      answersSnapshot: true,
    },
  });

  if (history.length === 0) {
    return NextResponse.json({ weakServices: [], analyzedSessions: 0 });
  }

  const questionIds = new Set<string>();
  for (const item of history) {
    const answers = toSnapshotAnswers(item.answersSnapshot);
    for (const answer of answers) {
      if (typeof answer.questionId === "string" && answer.questionId.length > 0) {
        questionIds.add(answer.questionId);
      }
    }
  }

  if (questionIds.size === 0) {
    return NextResponse.json({ weakServices: [], analyzedSessions: history.length });
  }

  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: Array.from(questionIds).slice(0, 1200) } },
    select: {
      id: true,
      topic: true,
      questionAwsServices: {
        select: {
          service: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
      awsService: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  const byQuestionId = new Map(questions.map((question) => [question.id, question]));
  const aggregate = new Map<string, WeakServiceStat>();

  for (const item of history) {
    const answers = toSnapshotAnswers(item.answersSnapshot);
    for (const answer of answers) {
      if (typeof answer.questionId !== "string" || answer.questionId.length === 0) {
        continue;
      }

      const question = byQuestionId.get(answer.questionId);
      const topic = question?.topic?.trim() || "OUTROS";
      const normalizedService = question?.questionAwsServices?.[0]?.service;
      const serviceCode = normalizedService?.code ?? question?.awsService?.code ?? topic;
      const serviceName = normalizedService?.name ?? question?.awsService?.name ?? topic;
      const key = `${serviceCode.toUpperCase()}::${topic.toUpperCase()}`;

      const current =
        aggregate.get(key) ??
        ({
          topic,
          serviceCode,
          serviceName,
          attempts: 0,
          errors: 0,
          correct: 0,
          errorRate: 0,
        } as WeakServiceStat);

      current.attempts += 1;

      const isCorrect = isCorrectAnswer({
        questionType: normalizeQuestionType(answer.questionType),
        selectedOption: answer.selectedOption,
        selectedOptions: answer.selectedOptions,
        correctOption: answer.correctOption,
        correctOptions: answer.correctOptions,
      });

      if (isCorrect) {
        current.correct += 1;
      } else {
        current.errors += 1;
      }

      aggregate.set(key, current);
    }
  }

  const weakServices = Array.from(aggregate.values())
    .map((item) => ({
      ...item,
      errorRate: item.attempts > 0 ? Math.round((item.errors / item.attempts) * 100) : 0,
    }))
    .filter((item) => item.errors > 0)
    .sort((a, b) => {
      if (b.errorRate !== a.errorRate) {
        return b.errorRate - a.errorRate;
      }
      if (b.errors !== a.errors) {
        return b.errors - a.errors;
      }
      return b.attempts - a.attempts;
    })
    .slice(0, take);

  return NextResponse.json({
    weakServices,
    analyzedSessions: history.length,
  });
}
