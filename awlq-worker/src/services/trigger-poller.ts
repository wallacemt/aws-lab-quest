import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";
import {
  questionGenerationQueue,
  feedbackAnalysisQueue,
  sourceFetchQueue,
  emailSendQueue,
  behavioralEmailQueue,
  flashcardGenerationQueue,
  kcGenerationQueue,
  mentorComputeQueue,
  changelogFetchQueue,
  newsFetchQueue,
  trailIllustrationQueue,
  trailReviewQueue,
  dailyQuizQueue,
  weeklyChallengeQueue,
} from "../queues/index.js";
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
        const certs = trigger.certificationPresetId
          ? await prisma.certificationPreset.findMany({
              where: { id: trigger.certificationPresetId, active: true },
              select: {
                id: true, code: true, name: true,
                blueprintDomains: {
                  where: { active: true },
                  select: { domainName: true, weightPercent: true, subTopics: true },
                },
              },
            })
          : await prisma.certificationPreset.findMany({
              where: { active: true },
              select: {
                id: true, code: true, name: true,
                blueprintDomains: {
                  where: { active: true },
                  select: { domainName: true, weightPercent: true, subTopics: true },
                },
              },
            });

        for (const cert of certs) {
          const domains =
            cert.blueprintDomains.length > 0
              ? cert.blueprintDomains.map((d) => ({
                  domainName: d.domainName,
                  weightPercent: d.weightPercent,
                  subTopics: Array.isArray(d.subTopics) ? (d.subTopics as string[]) : [],
                }))
              : [{ domainName: "General AWS", weightPercent: 100, subTopics: [] }];

          await questionGenerationQueue.add(
            `manual-generate-${cert.code}`,
            {
              certificationPresetId: cert.id,
              certificationCode: cert.code,
              certificationName: cert.name,
              triggerType: "manual",
              domains,
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

      case "email-send": {
        const payload = trigger.payload as {
          templateId?: string;
          subject?: string;
          html?: string;
          targetMode?: string;
          userId?: string;
          userIds?: string[];
        } | null;
        const hasTemplate = Boolean(payload?.templateId);
        const hasRawContent = Boolean(payload?.subject && payload?.html);
        if (hasTemplate || hasRawContent) {
          await emailSendQueue.add("admin-email-send", {
            templateId: payload?.templateId,
            subject: payload?.subject,
            html: payload?.html,
            targetMode: (payload?.targetMode ?? "all-users") as "all-users" | "single-user" | "specific-users",
            userId: payload?.userId,
            userIds: payload?.userIds,
          });
        } else {
          logger.warn({ triggerId: trigger.id }, "email-send trigger missing templateId or subject+html payload");
        }
        break;
      }

      case "behavioral-email-analysis": {
        await behavioralEmailQueue.add("manual-behavioral-analysis", { mode: "analyze" }, { priority: 1 });
        break;
      }

      case "generate-flashcards": {
        const payload = trigger.payload as { userId?: string; sinceSessionId?: string } | null;
        if (payload?.userId) {
          await flashcardGenerationQueue.add(
            `flashcards-${payload.userId}`,
            { userId: payload.userId, sinceSessionId: payload.sinceSessionId },
          );
        } else {
          logger.warn({ triggerId: trigger.id }, "generate-flashcards trigger missing userId payload");
        }
        break;
      }

      case "generate-kc": {
        const payload = trigger.payload as {
          requestId?: string;
          userId?: string;
          certificationPresetId?: string;
          serviceCode?: string;
          topic?: string;
          difficulty?: string;
          count?: number;
        } | null;
        if (payload?.requestId && payload.userId) {
          await kcGenerationQueue.add(
            `kc-${payload.requestId}`,
            {
              requestId: payload.requestId,
              userId: payload.userId,
              certificationPresetId: payload.certificationPresetId,
              serviceCode: payload.serviceCode,
              topic: payload.topic,
              difficulty: (payload.difficulty ?? "hard") as "easy" | "medium" | "hard" | "nightmare",
              count: payload.count ?? 10,
            },
            // On-demand KC generation is user-facing: run before scheduled background jobs (ADR-KC-02).
            { priority: 1 },
          );
        } else {
          logger.warn({ triggerId: trigger.id }, "generate-kc trigger missing requestId or userId");
        }
        break;
      }

      case "compute-mentor": {
        const payload = trigger.payload as { userId?: string } | null;
        if (payload?.userId) {
          await mentorComputeQueue.add(`mentor-${payload.userId}`, { userId: payload.userId });
        } else {
          logger.warn({ triggerId: trigger.id }, "compute-mentor trigger missing userId payload");
        }
        break;
      }

      case "changelog-fetch": {
        await changelogFetchQueue.add("manual-changelog-fetch", { manual: true }, { priority: 1 });
        break;
      }

      case "news-fetch": {
        const payload = trigger.payload as { sourceId?: string } | null;
        await newsFetchQueue.add("manual-news-fetch", { sourceId: payload?.sourceId }, { priority: 1 });
        break;
      }

      // Reuses the same idempotent seedDailyQuiz() the cron runs — no-ops if today's
      // quiz already exists, so this is safe to fire even if a quiz is already seeded.
      case "daily-quiz-seed": {
        await dailyQuizQueue.add("manual-daily-quiz-seed", {}, { priority: 1 });
        break;
      }

      case "generate-trail-illustration": {
        const payload = trigger.payload as { stageId?: string } | null;
        if (payload?.stageId) {
          await trailIllustrationQueue.add(`trail-illustration-${payload.stageId}`, { stageId: payload.stageId });
        } else {
          logger.warn({ triggerId: trigger.id }, "generate-trail-illustration trigger missing stageId");
        }
        break;
      }

      case "review-trail-explain": {
        const payload = trigger.payload as { stageId?: string } | null;
        if (payload?.stageId) {
          await trailReviewQueue.add(`trail-review-${payload.stageId}`, { stageId: payload.stageId });
        } else {
          logger.warn({ triggerId: trigger.id }, "review-trail-explain trigger missing stageId");
        }
        break;
      }

      case "weekly-challenge-force": {
        const payload = trigger.payload as { mode?: "open" | "close" } | null;
        if (payload?.mode === "open" || payload?.mode === "close") {
          await weeklyChallengeQueue.add(`manual-weekly-challenge-${payload.mode}`, { mode: payload.mode }, { priority: 1 });
        } else {
          logger.warn({ triggerId: trigger.id }, "weekly-challenge-force trigger missing valid mode");
        }
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
