import { prisma } from "../prisma.js";
import { AnswerSnapshot, isCorrectAnswer } from "../shared/ingestion-pipeline.js";
import { logger } from "../shared/logger.js";

type SessionForDI = {
  questionId: string;
  correct: boolean;
  sessionScore: number;
};

function computeDiscriminationIndex(questionId: string, data: SessionForDI[]): number {
  const relevant = data.filter((d) => d.questionId === questionId);
  if (relevant.length < 6) return 0;

  const allSessions = [...new Map(data.map((d) => [d.sessionScore, d])).values()];
  allSessions.sort((a, b) => b.sessionScore - a.sessionScore);

  const n = Math.ceil(allSessions.length * 0.27);
  const topScores = new Set(allSessions.slice(0, n).map((s) => s.sessionScore));
  const bottomScores = new Set(allSessions.slice(-n).map((s) => s.sessionScore));

  const topGroup = relevant.filter((d) => topScores.has(d.sessionScore));
  const bottomGroup = relevant.filter((d) => bottomScores.has(d.sessionScore));

  if (topGroup.length === 0 || bottomGroup.length === 0) return 0;

  const topRate = topGroup.filter((d) => d.correct).length / topGroup.length;
  const bottomRate = bottomGroup.filter((d) => d.correct).length / bottomGroup.length;

  return Math.round((topRate - bottomRate) * 1000) / 1000;
}

export type QuestionStats = {
  questionId: string;
  totalAttempts: number;
  totalCorrect: number;
  correctRate: number;
  discriminationIndex: number;
  reportCount: number;
};

export async function computePerformanceForCert(
  certificationPresetId?: string
): Promise<QuestionStats[]> {
  const cert = certificationPresetId
    ? await prisma.certificationPreset.findUnique({
        where: { id: certificationPresetId },
        select: { code: true },
      })
    : null;

  const questions = await prisma.studyQuestion.findMany({
    where: {
      active: true,
      ...(cert ? { certificationPreset: { code: cert.code } } : {}),
    },
    select: {
      id: true,
      questionReports: { select: { id: true } },
    },
  });

  if (questions.length === 0) return [];

  const questionIds = questions.map((q) => q.id);
  const reportCounts = new Map(questions.map((q) => [q.id, q.questionReports.length]));

  // Fetch all sessions that contain these questions
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // last 90 days
  const sessions = await prisma.studySessionHistory.findMany({
    where: {
      completedAt: { gte: since },
      ...(cert ? { certificationCode: cert.code } : {}),
    },
    select: { answersSnapshot: true, scorePercent: true },
  });

  // Build flat data structure for DI calculation
  const allData: SessionForDI[] = [];
  const attemptsMap = new Map<string, { correct: number; total: number }>();

  for (const session of sessions) {
    const answers = session.answersSnapshot as AnswerSnapshot[];
    if (!Array.isArray(answers)) continue;

    for (const answer of answers) {
      if (!questionIds.includes(answer.questionId)) continue;
      const correct = isCorrectAnswer(answer);

      allData.push({
        questionId: answer.questionId,
        correct,
        sessionScore: session.scorePercent,
      });

      const acc = attemptsMap.get(answer.questionId) ?? { correct: 0, total: 0 };
      acc.total++;
      if (correct) acc.correct++;
      attemptsMap.set(answer.questionId, acc);
    }
  }

  const stats: QuestionStats[] = [];
  for (const qId of questionIds) {
    const acc = attemptsMap.get(qId) ?? { correct: 0, total: 0 };
    const correctRate = acc.total > 0 ? acc.correct / acc.total : 0;
    const di = computeDiscriminationIndex(qId, allData);

    stats.push({
      questionId: qId,
      totalAttempts: acc.total,
      totalCorrect: acc.correct,
      correctRate: Math.round(correctRate * 1000) / 1000,
      discriminationIndex: di,
      reportCount: reportCounts.get(qId) ?? 0,
    });
  }

  logger.info(
    { certificationPresetId, computed: stats.length },
    "Performance computation complete"
  );

  return stats;
}

export function flagsForQuestion(stats: QuestionStats): string | null {
  if (stats.totalAttempts < 20) return null;
  if (stats.correctRate > 0.9) return "too_easy";
  if (stats.correctRate < 0.15) return "too_hard";
  if (stats.totalAttempts >= 30 && stats.discriminationIndex < 0) return "poor_discrimination";
  if (
    stats.reportCount >= 3 &&
    stats.totalAttempts > 0 &&
    stats.reportCount / stats.totalAttempts > 0.05
  ) {
    return "high_report_rate";
  }
  return null;
}
