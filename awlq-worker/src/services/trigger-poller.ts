import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";
import { questionGenerationQueue, feedbackAnalysisQueue, sourceFetchQueue, qualityReviewQueue } from "../queues/index.js";
import { config } from "../config.js";

async function processOneTrigger(): Promise<void> {
  const trigger = await prisma.workerTrigger.findFirst({
    where: { processed: false },
    orderBy: { createdAt: "asc" },
  });

  if (!trigger) return;

  logger.info({ action: trigger.action, id: trigger.id }, "Processing WorkerTrigger");

  try {
    switch (trigger.action) {
      case "generate": {
        const cert = trigger.certificationPresetId
          ? await prisma.certificationPreset.findUnique({
              where: { id: trigger.certificationPresetId },
              select: { id: true, code: true, name: true, blueprintDomains: true },
            })
          : null;

        if (cert) {
          await questionGenerationQueue.add(
            "manual-generate",
            {
              certificationPresetId: cert.id,
              certificationCode: cert.code,
              certificationName: cert.name,
              triggerType: "manual",
              domains: cert.blueprintDomains.map((d) => ({
                domainName: d.domainName,
                weightPercent: d.weightPercent,
                subTopics: Array.isArray(d.subTopics) ? (d.subTopics as string[]) : [],
              })),
              targetCount: 20,
            },
            { priority: 1 }
          );
        }
        break;
      }

      case "analyze-feedback": {
        const certs = trigger.certificationPresetId
          ? await prisma.certificationPreset.findMany({
              where: { id: trigger.certificationPresetId, active: true },
              select: { id: true, code: true },
            })
          : await prisma.certificationPreset.findMany({
              where: { active: true },
              select: { id: true, code: true },
            });

        for (const cert of certs) {
          await feedbackAnalysisQueue.add("manual-feedback", {
            certificationPresetId: cert.id,
            certificationCode: cert.code,
            windowDays: config.worker.weakAreaWindowDays,
          });
        }
        break;
      }

      case "fetch-sources": {
        const sources = await prisma.ingestionSource.findMany({
          where: {
            active: true,
            ...(trigger.certificationPresetId
              ? { certificationPresetId: trigger.certificationPresetId }
              : {}),
          },
          select: { id: true, url: true, certificationPreset: { select: { code: true } } },
        });

        for (const src of sources) {
          await sourceFetchQueue.add(
            "manual-fetch",
            {
              ingestionSourceId: src.id,
              url: src.url,
              certificationCode: src.certificationPreset?.code ?? "UNKNOWN",
              force: true,
            },
            { priority: 5 }
          );
        }
        break;
      }

      case "quality-scan": {
        // Enqueue via performance-compute which will then flag
        const { performanceComputeQueue } = await import("../queues/index.js");
        await performanceComputeQueue.add("manual-quality-scan", {
          certificationPresetId: trigger.certificationPresetId ?? undefined,
          forceRecompute: true,
        });
        break;
      }

      default:
        logger.warn({ action: trigger.action }, "Unknown WorkerTrigger action");
    }
  } catch (err) {
    logger.error({ err, triggerId: trigger.id }, "Failed to process WorkerTrigger");
  }

  await prisma.workerTrigger.update({
    where: { id: trigger.id },
    data: { processed: true, processedAt: new Date() },
  });
}

export function startTriggerPoller(): NodeJS.Timeout {
  logger.info("WorkerTrigger poller started");

  const interval = setInterval(() => {
    processOneTrigger().catch((err) =>
      logger.error({ err }, "Trigger poller iteration error")
    );
  }, config.worker.triggerPollIntervalMs);

  return interval;
}
