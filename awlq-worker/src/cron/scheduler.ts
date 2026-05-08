import {
  sourceFetchQueue,
  questionGenerationQueue,
  feedbackAnalysisQueue,
  performanceComputeQueue,
} from "../queues/index.js";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { logger } from "../shared/logger.js";

async function getActiveCerts() {
  return prisma.certificationPreset.findMany({
    where: { active: true },
    select: {
      id: true,
      code: true,
      name: true,
      blueprintDomains: {
        where: { active: true },
        select: { domainName: true, weightPercent: true, subTopics: true },
      },
    },
  });
}

async function getActiveSources() {
  return prisma.ingestionSource.findMany({
    where: { active: true },
    select: {
      id: true,
      url: true,
      certificationPreset: { select: { code: true } },
    },
  });
}

export async function registerCronJobs(): Promise<void> {
  logger.info("Registering cron jobs");

  // ── 03:00 UTC daily: fetch all active sources ─────────────────────────────
  await sourceFetchQueue.add(
    "source-fetch-daily",
    { ingestionSourceId: "__cron__", url: "__cron__", certificationCode: "__cron__" },
    {
      repeat: { pattern: "0 3 * * *" },
      jobId: "cron-source-fetch-daily",
    }
  );

  // ── 04:00 UTC daily: feedback analysis per cert ───────────────────────────
  await feedbackAnalysisQueue.add(
    "feedback-analysis-daily",
    { certificationPresetId: "__cron__", certificationCode: "__cron__", windowDays: config.worker.weakAreaWindowDays },
    {
      repeat: { pattern: "0 4 * * *" },
      jobId: "cron-feedback-daily",
    }
  );

  // ── 05:00 UTC daily: scheduled generation per cert ────────────────────────
  await questionGenerationQueue.add(
    "question-generation-scheduled",
    {
      certificationPresetId: "__cron__",
      certificationCode: "__cron__",
      certificationName: "__cron__",
      triggerType: "scheduled",
      domains: [],
      targetCount: 0,
    },
    {
      repeat: { pattern: "0 5 * * *" },
      jobId: "cron-generation-scheduled",
    }
  );

  // ── every hour: recompute QuestionPerformance ─────────────────────────────
  await performanceComputeQueue.add(
    "performance-compute-hourly",
    {},
    {
      repeat: { pattern: "0 * * * *" },
      jobId: "cron-performance-hourly",
    }
  );

  // ── 02:00 UTC Sunday: force re-fetch all sources ──────────────────────────
  await sourceFetchQueue.add(
    "source-fetch-weekly-force",
    { ingestionSourceId: "__cron__", url: "__cron__", certificationCode: "__cron__", force: true },
    {
      repeat: { pattern: "0 2 * * 0" },
      jobId: "cron-source-fetch-weekly",
    }
  );

  logger.info("Cron jobs registered");
}

// The cron jobs above use sentinel data. The actual workers detect __cron__ and
// expand them into real jobs for each cert / source at runtime.
export async function expandCronJob(
  type: "source-fetch" | "feedback-analysis" | "question-generation" | "performance-compute",
  force = false
): Promise<void> {
  if (type === "source-fetch") {
    const sources = await getActiveSources();
    for (const src of sources) {
      await sourceFetchQueue.add(`fetch-${src.id}`, {
        ingestionSourceId: src.id,
        url: src.url,
        certificationCode: src.certificationPreset?.code ?? "UNKNOWN",
        force,
      });
    }
    logger.info({ count: sources.length, force }, "cron: source-fetch expanded");
  }

  if (type === "feedback-analysis") {
    const certs = await getActiveCerts();
    for (const cert of certs) {
      await feedbackAnalysisQueue.add(`feedback-${cert.code}`, {
        certificationPresetId: cert.id,
        certificationCode: cert.code,
        windowDays: config.worker.weakAreaWindowDays,
      });
    }
    logger.info({ count: certs.length }, "cron: feedback-analysis expanded");
  }

  if (type === "question-generation") {
    const certs = await getActiveCerts();
    for (const cert of certs) {
      const domains =
        cert.blueprintDomains.length > 0
          ? cert.blueprintDomains.map((d) => ({
              domainName: d.domainName,
              weightPercent: d.weightPercent,
              subTopics: Array.isArray(d.subTopics) ? (d.subTopics as string[]) : [],
            }))
          : [{ domainName: "General AWS", weightPercent: 100, subTopics: [] }];

      await questionGenerationQueue.add(`gen-${cert.code}`, {
        certificationPresetId: cert.id,
        certificationCode: cert.code,
        certificationName: cert.name,
        triggerType: "scheduled",
        domains,
        targetCount: 15,
        difficulty: "mixed",
      });
    }
    logger.info({ count: certs.length }, "cron: question-generation expanded");
  }

  if (type === "performance-compute") {
    await performanceComputeQueue.add("hourly-compute", {});
    logger.info("cron: performance-compute enqueued");
  }
}
