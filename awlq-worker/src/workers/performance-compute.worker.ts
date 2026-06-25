import { Worker } from "bullmq";
import { connection, PerformanceComputeJobData, qualityReviewQueue } from "../queues/index.js";
import { prisma } from "../prisma.js";
import {
  computePerformanceForCert,
  flagsForQuestion,
} from "../services/performance-calculator.js";
import { logger } from "../shared/logger.js";

export function createPerformanceComputeWorker(): Worker {
  return new Worker<PerformanceComputeJobData>(
    "performance-compute",
    async (job) => {
      const { certificationPresetId, forceRecompute } = job.data;

      logger.info({ certificationPresetId, forceRecompute }, "performance-compute: starting");

      const stats = await computePerformanceForCert(certificationPresetId);

      let updatedCount = 0;
      let flaggedCount = 0;

      for (const s of stats) {
        const flagReason = flagsForQuestion(s);

        // Upsert QuestionPerformance record
        await prisma.questionPerformance.upsert({
          where: { questionId: s.questionId },
          update: {
            totalAttempts: s.totalAttempts,
            totalCorrect: s.totalCorrect,
            correctRate: s.correctRate,
            discriminationIndex: s.discriminationIndex,
            reportCount: s.reportCount,
            lastComputedAt: new Date(),
            flaggedForReview: flagReason !== null,
            flagReason: flagReason ?? undefined,
          },
          create: {
            questionId: s.questionId,
            totalAttempts: s.totalAttempts,
            totalCorrect: s.totalCorrect,
            correctRate: s.correctRate,
            discriminationIndex: s.discriminationIndex,
            reportCount: s.reportCount,
            lastComputedAt: new Date(),
            flaggedForReview: flagReason !== null,
            flagReason: flagReason ?? undefined,
          },
        });

        updatedCount++;

        // Enqueue quality review for newly flagged questions
        if (flagReason) {
          const alreadyReviewed = await prisma.questionPerformance.findUnique({
            where: { questionId: s.questionId },
            select: { reviewResult: true, reviewedAt: true },
          });

          // Only enqueue if never reviewed OR reviewed > 14 days ago
          const shouldRequeue =
            !alreadyReviewed?.reviewResult ||
            (alreadyReviewed.reviewedAt &&
              Date.now() - alreadyReviewed.reviewedAt.getTime() > 14 * 24 * 60 * 60 * 1000);

          if (shouldRequeue) {
            await qualityReviewQueue.add(`review-${s.questionId}`, {
              questionId: s.questionId,
              flagReason: flagReason as
                | "too_easy"
                | "too_hard"
                | "high_report_rate"
                | "poor_discrimination",
              correctRate: s.correctRate,
              reportCount: s.reportCount,
            });
            flaggedCount++;
          }
        }
      }

      logger.info(
        { updatedCount, flaggedCount, certificationPresetId },
        "performance-compute: done"
      );
    },
    { connection, concurrency: 3 }
  );
}
