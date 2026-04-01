import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
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

type WeakAggregate = {
  serviceCode: string;
  serviceName: string;
  attempts: number;
  errors: number;
};

function toSnapshotAnswers(value: unknown): SnapshotAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as SnapshotAnswer[];
}

function parseDays(value: string | null): number {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) {
    return 30;
  }

  return Math.max(7, Math.min(180, Math.round(parsed)));
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const days = parseDays(request.nextUrl.searchParams.get("days"));
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const [usersTotal, questionsTotal, sessionsTotal, sessionsStats] = await Promise.all([
    prisma.user.count(),
    prisma.studyQuestion.count(),
    prisma.studySessionHistory.count(),
    prisma.studySessionHistory.aggregate({
      where: {
        completedAt: { gte: startDate },
      },
      _avg: {
        scorePercent: true,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const passingSessions = await prisma.studySessionHistory.count({
    where: {
      completedAt: { gte: startDate },
      scorePercent: { gte: 70 },
    },
  });

  const [newUsers, sessionsInPeriod] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
    }),
    prisma.studySessionHistory.findMany({
      where: { completedAt: { gte: startDate } },
      select: { completedAt: true },
    }),
  ]);

  const timelineMap = new Map<string, { users: number; sessions: number }>();
  for (let i = 0; i < days; i += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    timelineMap.set(formatDay(date), { users: 0, sessions: 0 });
  }

  for (const user of newUsers) {
    const key = formatDay(user.createdAt);
    const current = timelineMap.get(key);
    if (current) {
      current.users += 1;
    }
  }

  for (const session of sessionsInPeriod) {
    const key = formatDay(session.completedAt);
    const current = timelineMap.get(key);
    if (current) {
      current.sessions += 1;
    }
  }

  const [difficultyGroups, usageGroups, certificationGroups] = await Promise.all([
    prisma.studyQuestion.groupBy({
      by: ["difficulty"],
      _count: { _all: true },
    }),
    prisma.studyQuestion.groupBy({
      by: ["usage"],
      _count: { _all: true },
    }),
    prisma.studyQuestion.groupBy({
      by: ["certificationPresetId"],
      _count: { _all: true },
    }),
  ]);

  const certificationIds = certificationGroups
    .map((item) => item.certificationPresetId)
    .filter((value): value is string => typeof value === "string");

  const certifications = certificationIds.length
    ? await prisma.certificationPreset.findMany({
        where: { id: { in: certificationIds } },
        select: { id: true, code: true },
      })
    : [];

  const certificationById = new Map(certifications.map((item) => [item.id, item.code]));

  const weakSessions = await prisma.studySessionHistory.findMany({
    where: {
      sessionType: "SIMULADO",
      completedAt: { gte: startDate },
    },
    orderBy: { completedAt: "desc" },
    take: 250,
    select: {
      answersSnapshot: true,
    },
  });

  const questionIds = new Set<string>();
  for (const session of weakSessions) {
    const answers = toSnapshotAnswers(session.answersSnapshot);
    for (const answer of answers) {
      if (typeof answer.questionId === "string" && answer.questionId.length > 0) {
        questionIds.add(answer.questionId);
      }
    }
  }

  const weakQuestions = questionIds.size
    ? await prisma.studyQuestion.findMany({
        where: { id: { in: Array.from(questionIds) } },
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
      })
    : [];

  const questionById = new Map(weakQuestions.map((question) => [question.id, question]));
  const weakAggregate = new Map<string, WeakAggregate>();

  for (const session of weakSessions) {
    const answers = toSnapshotAnswers(session.answersSnapshot);
    for (const answer of answers) {
      if (typeof answer.questionId !== "string" || answer.questionId.length === 0) {
        continue;
      }

      const question = questionById.get(answer.questionId);
      const normalizedService = question?.questionAwsServices?.[0]?.service;
      const serviceCode = normalizedService?.code ?? question?.awsService?.code ?? question?.topic ?? "OUTROS";
      const serviceName = normalizedService?.name ?? question?.awsService?.name ?? question?.topic ?? "OUTROS";
      const current =
        weakAggregate.get(serviceCode) ?? ({ serviceCode, serviceName, attempts: 0, errors: 0 } as WeakAggregate);

      current.attempts += 1;
      const isCorrect = isCorrectAnswer({
        questionType: normalizeQuestionType(answer.questionType),
        selectedOption: answer.selectedOption,
        selectedOptions: answer.selectedOptions,
        correctOption: answer.correctOption,
        correctOptions: answer.correctOptions,
      });

      if (!isCorrect) {
        current.errors += 1;
      }

      weakAggregate.set(serviceCode, current);
    }
  }

  const questXp = await prisma.questHistory.groupBy({
    by: ["userId"],
    _sum: { xp: true },
    orderBy: { _sum: { xp: "desc" } },
    take: 50,
  });

  const studyXp = await prisma.studySessionHistory.groupBy({
    by: ["userId"],
    _sum: { gainedXp: true },
    orderBy: { _sum: { gainedXp: "desc" } },
    take: 50,
  });

  const xpMap = new Map<string, number>();
  for (const item of questXp) {
    xpMap.set(item.userId, (xpMap.get(item.userId) ?? 0) + (item._sum.xp ?? 0));
  }
  for (const item of studyXp) {
    xpMap.set(item.userId, (xpMap.get(item.userId) ?? 0) + (item._sum.gainedXp ?? 0));
  }

  const rankingIds = Array.from(xpMap.keys()).slice(0, 30);
  const rankingUsers = rankingIds.length
    ? await prisma.user.findMany({
        where: { id: { in: rankingIds } },
        select: { id: true, name: true },
      })
    : [];
  const rankingUserMap = new Map(rankingUsers.map((item) => [item.id, item.name]));

  const ranking = Array.from(xpMap.entries())
    .map(([userId, totalXp]) => ({
      userId,
      userName: rankingUserMap.get(userId) ?? "Usuario",
      totalXp,
    }))
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, 10);

  return NextResponse.json({
    overview: {
      totals: {
        users: usersTotal,
        questions: questionsTotal,
        studySessions: sessionsTotal,
      },
      averageScorePercent: Math.round(sessionsStats._avg.scorePercent ?? 0),
      passRatePercent:
        sessionsStats._count._all > 0 ? Math.round((passingSessions / sessionsStats._count._all) * 100) : 0,
    },
    timeline: Array.from(timelineMap.entries()).map(([date, value]) => ({
      date,
      users: value.users,
      sessions: value.sessions,
    })),
    distribution: {
      byDifficulty: difficultyGroups.map((item) => ({
        label: item.difficulty,
        count: item._count._all,
      })),
      byUsage: usageGroups.map((item) => ({
        label: item.usage,
        count: item._count._all,
      })),
      byCertification: certificationGroups
        .map((item) => ({
          label: item.certificationPresetId
            ? (certificationById.get(item.certificationPresetId) ?? "SEM_CERT")
            : "SEM_CERT",
          count: item._count._all,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    },
    weakServices: Array.from(weakAggregate.values())
      .map((item) => ({
        serviceCode: item.serviceCode,
        serviceName: item.serviceName,
        attempts: item.attempts,
        errors: item.errors,
        errorRate: item.attempts > 0 ? Math.round((item.errors / item.attempts) * 100) : 0,
      }))
      .filter((item) => item.attempts >= 3)
      .sort((a, b) => {
        if (b.errorRate !== a.errorRate) {
          return b.errorRate - a.errorRate;
        }
        return b.errors - a.errors;
      })
      .slice(0, 8),
    ranking,
  });
}
