import { prisma } from "../prisma.js";
import { AnswerSnapshot, isCorrectAnswer } from "../shared/ingestion-pipeline.js";
import { logger } from "../shared/logger.js";

export type WeakAreaEntry = {
  dimension: "service" | "topic";
  dimensionId: string;
  dimensionLabel: string;
  attempts: number;
  correctRate: number;
  targetCount: number;
};

export type WeakAreaAnalysis = {
  certificationPresetId: string;
  certificationCode: string;
  sessionsAnalyzed: number;
  weakAreas: WeakAreaEntry[];
};

type QuestionMeta = {
  id: string;
  serviceCodes: string[];
  topicNames: string[];
};

function computeTargetCount(correctRate: number): number {
  const deficit = Math.max(0, 0.6 - correctRate);
  return Math.min(30, Math.max(5, Math.round(deficit * 50)));
}

export async function analyzeWeakAreas(
  certificationPresetId: string,
  certificationCode: string,
  windowDays: number
): Promise<WeakAreaAnalysis> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const sessions = await prisma.studySessionHistory.findMany({
    where: { certificationCode, completedAt: { gte: since } },
    select: { id: true, answersSnapshot: true, scorePercent: true },
  });

  if (sessions.length === 0) {
    return {
      certificationPresetId,
      certificationCode,
      sessionsAnalyzed: 0,
      weakAreas: [],
    };
  }

  // Collect all question IDs referenced in sessions
  const allQuestionIds = new Set<string>();
  for (const session of sessions) {
    const answers = session.answersSnapshot as AnswerSnapshot[];
    if (Array.isArray(answers)) {
      for (const a of answers) {
        if (a.questionId) allQuestionIds.add(a.questionId);
      }
    }
  }

  // Fetch question metadata in bulk
  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: Array.from(allQuestionIds) } },
    select: {
      id: true,
      questionAwsServices: { select: { service: { select: { code: true, name: true } } } },
      questionTopics: { select: { topic: { select: { name: true } } } },
    },
  });

  const questionMetaMap = new Map<string, QuestionMeta>();
  for (const q of questions) {
    questionMetaMap.set(q.id, {
      id: q.id,
      serviceCodes: q.questionAwsServices.map((r) => r.service.code),
      topicNames: q.questionTopics.map((r) => r.topic.name),
    });
  }

  // Accumulate per-dimension stats
  const serviceAcc = new Map<string, { attempts: number; correct: number; label: string }>();
  const topicAcc = new Map<string, { attempts: number; correct: number }>();

  for (const session of sessions) {
    const answers = session.answersSnapshot as AnswerSnapshot[];
    if (!Array.isArray(answers)) continue;

    for (const answer of answers) {
      const meta = questionMetaMap.get(answer.questionId);
      if (!meta) continue;

      const correct = isCorrectAnswer(answer);

      for (const code of meta.serviceCodes) {
        const acc = serviceAcc.get(code) ?? { attempts: 0, correct: 0, label: code };
        acc.attempts++;
        if (correct) acc.correct++;
        serviceAcc.set(code, acc);
      }

      for (const name of meta.topicNames) {
        const acc = topicAcc.get(name) ?? { attempts: 0, correct: 0 };
        acc.attempts++;
        if (correct) acc.correct++;
        topicAcc.set(name, acc);
      }
    }
  }

  const MIN_ATTEMPTS = 5;
  const THRESHOLD = 0.6;
  const weakAreas: WeakAreaEntry[] = [];

  for (const [code, acc] of serviceAcc) {
    if (acc.attempts < MIN_ATTEMPTS) continue;
    const correctRate = acc.correct / acc.attempts;
    if (correctRate < THRESHOLD) {
      weakAreas.push({
        dimension: "service",
        dimensionId: code,
        dimensionLabel: acc.label,
        attempts: acc.attempts,
        correctRate,
        targetCount: computeTargetCount(correctRate),
      });
    }
  }

  for (const [name, acc] of topicAcc) {
    if (acc.attempts < MIN_ATTEMPTS) continue;
    const correctRate = acc.correct / acc.attempts;
    if (correctRate < THRESHOLD) {
      weakAreas.push({
        dimension: "topic",
        dimensionId: name,
        dimensionLabel: name,
        attempts: acc.attempts,
        correctRate,
        targetCount: computeTargetCount(correctRate),
      });
    }
  }

  // Sort by worst first
  weakAreas.sort((a, b) => a.correctRate - b.correctRate);

  logger.info(
    { certificationCode, sessionsAnalyzed: sessions.length, weakAreas: weakAreas.length },
    "Weak area analysis complete"
  );

  return {
    certificationPresetId,
    certificationCode,
    sessionsAnalyzed: sessions.length,
    weakAreas,
  };
}
