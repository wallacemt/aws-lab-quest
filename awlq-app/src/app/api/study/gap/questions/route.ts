import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCorrectAnswer, normalizeQuestionType } from "@/lib/study-answer-utils";

type SnapshotAnswer = {
  questionId?: unknown;
  statement?: unknown;
  questionType?: unknown;
  selectedOption?: unknown;
  selectedOptions?: unknown;
  correctOption?: unknown;
  correctOptions?: unknown;
  options?: unknown;
  explanations?: unknown;
  explanationSummary?: unknown;
  optionMapping?: unknown;
};

function toSnapshotAnswers(value: unknown): SnapshotAnswer[] {
  return Array.isArray(value) ? (value as SnapshotAnswer[]) : [];
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const topic = searchParams.get("topic")?.trim();
  const awsServiceId = searchParams.get("sid")?.trim() || null;

  if (!topic) {
    return NextResponse.json({ error: "Missing topic." }, { status: 400 });
  }

  const history = await prisma.studySessionHistory.findMany({
    where: { userId: session.user.id, sessionType: "SIMULADO" },
    orderBy: { completedAt: "desc" },
    take: 100,
    select: { answersSnapshot: true },
  });

  const questionIds = new Set<string>();
  for (const item of history) {
    for (const answer of toSnapshotAnswers(item.answersSnapshot)) {
      if (typeof answer.questionId === "string" && answer.questionId.length > 0) {
        questionIds.add(answer.questionId);
      }
    }
  }

  if (questionIds.size === 0) {
    return NextResponse.json({ questions: [] });
  }

  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: Array.from(questionIds).slice(0, 1200) } },
    select: {
      id: true,
      topic: true,
      awsServiceId: true,
      questionAwsServices: { select: { service: { select: { id: true } } } },
    },
  });

  const matchingIds = new Set(
    questions
      .filter((q) => {
        const resolvedServiceId = q.questionAwsServices?.[0]?.service?.id ?? q.awsServiceId ?? null;
        const topicMatches = q.topic.trim().toUpperCase() === topic.toUpperCase();
        return topicMatches && resolvedServiceId === awsServiceId;
      })
      .map((q) => q.id),
  );

  const wrongByQuestionId = new Map<string, SnapshotAnswer>();
  for (const item of history) {
    for (const answer of toSnapshotAnswers(item.answersSnapshot)) {
      if (typeof answer.questionId !== "string" || !matchingIds.has(answer.questionId)) {
        continue;
      }
      // Keep the most recent attempt per question (history is ordered desc).
      if (wrongByQuestionId.has(answer.questionId)) continue;

      const isCorrect = isCorrectAnswer({
        questionType: normalizeQuestionType(answer.questionType),
        selectedOption: answer.selectedOption,
        selectedOptions: answer.selectedOptions,
        correctOption: answer.correctOption,
        correctOptions: answer.correctOptions,
      });

      if (!isCorrect) {
        wrongByQuestionId.set(answer.questionId, answer);
      }
    }
  }

  return NextResponse.json({ questions: Array.from(wrongByQuestionId.values()) });
}
