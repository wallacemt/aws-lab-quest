import { Worker } from "bullmq";
import { redis, FeedbackAnalysisJobData, questionGenerationQueue } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { analyzeWeakAreas } from "../services/weak-area-analyzer.js";
import { logger } from "../shared/logger.js";

export function createFeedbackAnalysisWorker(): Worker {
  return new Worker<FeedbackAnalysisJobData>(
    "feedback-analysis",
    async (job) => {
      const { certificationPresetId, certificationCode, windowDays } = job.data;

      logger.info({ certificationCode, windowDays }, "feedback-analysis: starting");

      const analysis = await analyzeWeakAreas(certificationPresetId, certificationCode, windowDays);

      // Persist the WeakAreaReport
      const report = await prisma.weakAreaReport.create({
        data: {
          certificationPresetId,
          windowDays,
          sessionsAnalyzed: analysis.sessionsAnalyzed,
          weakAreas: analysis.weakAreas,
          generationQueued: false,
        },
        select: { id: true },
      });

      if (analysis.weakAreas.length === 0) {
        logger.info({ certificationCode }, "feedback-analysis: no weak areas detected");
        return;
      }

      // Fetch blueprint domains to use as context for generation
      const domains = await prisma.examBlueprintDomain.findMany({
        where: { certificationPresetId, active: true },
        select: { domainName: true, weightPercent: true, subTopics: true },
      });

      const cert = await prisma.certificationPreset.findUnique({
        where: { id: certificationPresetId },
        select: { name: true },
      });

      // Enqueue one generation job per weak area (priority = 10)
      for (const area of analysis.weakAreas) {
        const relevantDomains =
          domains.length > 0
            ? domains.map((d) => ({
                domainName: d.domainName,
                weightPercent: d.weightPercent,
                subTopics: Array.isArray(d.subTopics) ? (d.subTopics as string[]) : [],
              }))
            : [{ domainName: "General", weightPercent: 100, subTopics: [] }];

        await questionGenerationQueue.add(
          `weak-area-${area.dimensionId}`,
          {
            certificationPresetId,
            certificationCode,
            certificationName: cert?.name ?? certificationCode,
            triggerType: "weak_area",
            domains: relevantDomains,
            targetCount: area.targetCount,
            weakAreaFilter: {
              serviceCode: area.dimension === "service" ? area.dimensionId : undefined,
              topicName: area.dimension === "topic" ? area.dimensionId : undefined,
              targetCorrectRate: area.correctRate,
            },
          },
          { priority: 10 }
        );
      }

      await prisma.weakAreaReport.update({
        where: { id: report.id },
        data: { generationQueued: true },
      });

      await prisma.workerTrigger.createMany({
        data: analysis.weakAreas.map(() => ({
          action: "generate",
          source: "weak_area",
          certificationPresetId,
        })),
      });

      logger.info(
        { certificationCode, weakAreas: analysis.weakAreas.length },
        "feedback-analysis: generation jobs enqueued"
      );
    },
    { connection: redis, concurrency: 5 }
  );
}
