/**
 * Aggregates per-answer confidence signals from StudySessionHistory into FalseBeliefSignal rows.
 *
 * False belief = wrong answer + high confidence (the most pedagogically dangerous pattern).
 * Known gap = wrong answer + low confidence (user knows they don't know).
 * Mastery = correct answer + high confidence.
 *
 * Called by feedback-analysis.worker after processing a certification's sessions.
 */

import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";

type AnswerSnapshotItem = {
  questionId?: string;
  correct?: boolean;
  confidence?: "high" | "medium" | "low";
};

type SignalAccumulator = {
  falseBeliefCount: number;
  knownGapCount: number;
  masteryCount: number;
  awsServiceId: string | null;
  topic: string | null;
};

/**
 * Processes recent sessions for a user and upserts FalseBeliefSignal aggregates.
 * Uses a sliding window of `windowDays` days.
 */
export async function aggregateFalseBeliefs(userId: string, windowDays = 30): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const sessions = await prisma.studySessionHistory.findMany({
    where: { userId, completedAt: { gte: cutoff }, anonymized: false },
    select: { answersSnapshot: true },
    take: 100,
  });

  if (sessions.length === 0) return;

  // Collect question ids to fetch service context.
  const questionIds = new Set<string>();
  for (const session of sessions) {
    const snapshot = session.answersSnapshot as AnswerSnapshotItem[];
    if (!Array.isArray(snapshot)) continue;
    for (const item of snapshot) {
      if (item.questionId && item.confidence) questionIds.add(item.questionId);
    }
  }

  if (questionIds.size === 0) return;

  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: Array.from(questionIds) } },
    select: { id: true, awsServiceId: true, topic: true },
  });

  const questionMeta = new Map(questions.map((q) => [q.id, { awsServiceId: q.awsServiceId, topic: q.topic }]));

  // Accumulate signals grouped by (awsServiceId, topic).
  const signals = new Map<string, SignalAccumulator>();

  function getKey(awsServiceId: string | null, topic: string | null): string {
    return `${awsServiceId ?? ""}::${topic ?? ""}`;
  }

  for (const session of sessions) {
    const snapshot = session.answersSnapshot as AnswerSnapshotItem[];
    if (!Array.isArray(snapshot)) continue;

    for (const item of snapshot) {
      if (!item.questionId || !item.confidence) continue;

      const meta = questionMeta.get(item.questionId);
      const awsServiceId = meta?.awsServiceId ?? null;
      const topic = meta?.topic ?? null;
      const key = getKey(awsServiceId, topic);

      if (!signals.has(key)) {
        signals.set(key, { falseBeliefCount: 0, knownGapCount: 0, masteryCount: 0, awsServiceId, topic });
      }

      const acc = signals.get(key)!;

      if (item.correct === false && item.confidence === "high") acc.falseBeliefCount += 1;
      if (item.correct === false && item.confidence === "low") acc.knownGapCount += 1;
      if (item.correct === true && item.confidence === "high") acc.masteryCount += 1;
    }
  }

  // Upsert each signal group.
  // Note: nullable fields in Prisma unique constraints require a manual find + create/update
  // because Prisma's upsert `where` doesn't handle null fields in composite unique keys.
  for (const acc of signals.values()) {
    try {
      const existing = await prisma.falseBeliefSignal.findFirst({
        where: {
          userId,
          awsServiceId: acc.awsServiceId,
          topic: acc.topic,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.falseBeliefSignal.update({
          where: { id: existing.id },
          data: {
            falseBeliefCount: acc.falseBeliefCount,
            knownGapCount: acc.knownGapCount,
            masteryCount: acc.masteryCount,
            windowDays,
            computedAt: new Date(),
          },
        });
      } else {
        await prisma.falseBeliefSignal.create({
          data: {
            userId,
            awsServiceId: acc.awsServiceId,
            topic: acc.topic,
            falseBeliefCount: acc.falseBeliefCount,
            knownGapCount: acc.knownGapCount,
            masteryCount: acc.masteryCount,
            windowDays,
            computedAt: new Date(),
          },
        });
      }
    } catch (err) {
      logger.error({ userId, err }, "false-belief-aggregator: upsert failed");
    }
  }

  logger.info({ userId, signalGroups: signals.size }, "false-belief-aggregator: done");
}
