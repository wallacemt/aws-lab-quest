import { Queue } from "bullmq";
import {
  sourceFetchQueue,
  questionGenerationQueue,
  feedbackAnalysisQueue,
  performanceComputeQueue,
  dataRetentionQueue,
  behavioralEmailQueue,
  weeklyChallengeQueue,
  newsFetchQueue,
  changelogFetchQueue,
  dailyQuizQueue,
  flashcardReminderQueue,
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

const DEFAULT_JOBS = [
  {
    jobId: "cron-source-fetch-daily",
    name: "Fetch de Fontes (Diario)",
    description: "Busca todas as fontes de ingestion ativas",
    queue: "source-fetch",
    cronPattern: "0 3 * * *",
    payload: { ingestionSourceId: "__cron__", url: "__cron__", certificationCode: "__cron__" },
  },
  {
    jobId: "cron-feedback-daily",
    name: "Analise de Feedback (Diario)",
    description: "Analisa areas fracas por certificacao",
    queue: "feedback-analysis",
    cronPattern: "0 4 * * *",
    payload: { certificationPresetId: "__cron__", certificationCode: "__cron__" },
  },
  {
    jobId: "cron-generation-scheduled",
    name: "Geracao de Questoes (Diario)",
    description: "Gera 15 questoes por certificacao ativa",
    queue: "question-generation",
    cronPattern: "0 5 * * *",
    payload: { certificationPresetId: "__cron__", certificationCode: "__cron__", triggerType: "scheduled", domains: [], targetCount: 0 },
  },
  {
    jobId: "cron-performance-hourly",
    name: "Calculo de Performance (Horario)",
    description: "Recomputa metricas de qualidade das questoes",
    queue: "performance-compute",
    cronPattern: "0 * * * *",
    payload: {},
  },
  {
    jobId: "cron-source-fetch-weekly",
    name: "Fetch de Fontes Forcado (Semanal)",
    description: "Re-busca todas as fontes ignorando cache SHA256",
    queue: "source-fetch",
    cronPattern: "0 2 * * 0",
    payload: { ingestionSourceId: "__cron__", url: "__cron__", certificationCode: "__cron__", force: true },
  },
  {
    jobId: "cron-data-retention-daily",
    name: "Retencao de Dados (Diario)",
    description: "Anonimiza contas expiradas e historico antigo conforme LGPD",
    queue: "data-retention",
    // 03:30 daily — avoids collision with cron-source-fetch-daily (0 3 * * *)
    // which occupies 03:00, and cron-source-fetch-weekly (0 2 * * 0)
    // which occupies 02:00 on Sundays.
    cronPattern: "30 3 * * *",
    payload: {},
  },
  {
    jobId: "cron-behavioral-email-daily",
    name: "Emails Comportamentais (Diario)",
    description: "Analisa comportamento dos usuarios e agenda emails personalizados",
    queue: "behavioral-email",
    cronPattern: "0 23 * * *",
    payload: { mode: "analyze" },
  },
  // ─── Phase 4 crons ───────────────────────────────────────────────────────────
  {
    jobId: "cron-weekly-challenge-open",
    name: "Desafio Semanal — Abrir (Segunda-feira)",
    description: "Abre novo desafio semanal toda segunda-feira a 00:00 UTC",
    queue: "weekly-challenge",
    cronPattern: "0 0 * * 1",
    payload: { mode: "open" },
  },
  {
    jobId: "cron-weekly-challenge-close",
    name: "Desafio Semanal — Fechar (Domingo)",
    description: "Encerra o desafio semanal e computa ranking todo domingo a 23:55 UTC",
    queue: "weekly-challenge",
    cronPattern: "55 23 * * 0",
    payload: { mode: "close" },
  },
  {
    jobId: "cron-news-fetch",
    name: "Busca de Noticias (a cada 6h)",
    description: "Busca feeds RSS de noticias AWS e dev.to",
    queue: "news-fetch",
    cronPattern: "0 */6 * * *",
    payload: {},
  },
  {
    jobId: "cron-changelog-fetch",
    name: "Sync Changelog do GitHub (a cada 6h)",
    description: "Sincroniza releases do GitHub com a tabela ChangelogRelease",
    queue: "changelog-fetch",
    cronPattern: "0 */6 * * *",
    payload: {},
  },
  {
    jobId: "cron-daily-quiz-seed",
    name: "Seed Quiz Diario (00:05 UTC)",
    description: "Sorteia 5 questoes para o quiz diario do dia",
    queue: "daily-quiz",
    cronPattern: "5 0 * * *",
    payload: {},
  },
  {
    jobId: "cron-flashcard-reminder-daily",
    name: "Lembrete de Flashcards (Diario)",
    description: "Envia e-mail de lembrete para flashcards vencidos, agrupado por usuario",
    queue: "flashcard-reminder",
    cronPattern: "0 13 * * *",
    payload: {},
  },
] as const;

function getQueueByName(queue: string): Queue | null {
  switch (queue) {
    case "source-fetch": return sourceFetchQueue;
    case "question-generation": return questionGenerationQueue;
    case "feedback-analysis": return feedbackAnalysisQueue;
    case "performance-compute": return performanceComputeQueue;
    case "data-retention": return dataRetentionQueue;
    case "behavioral-email": return behavioralEmailQueue;
    case "weekly-challenge": return weeklyChallengeQueue;
    case "news-fetch": return newsFetchQueue;
    case "changelog-fetch": return changelogFetchQueue;
    case "daily-quiz": return dailyQuizQueue;
    case "flashcard-reminder": return flashcardReminderQueue;
    default: return null;
  }
}

function getJobNameForQueue(queue: string, jobId: string): string {
  switch (queue) {
    case "source-fetch": return jobId === "cron-source-fetch-weekly" ? "source-fetch-weekly-force" : "source-fetch-daily";
    case "feedback-analysis": return "feedback-analysis-daily";
    case "question-generation": return "question-generation-scheduled";
    case "performance-compute": return "performance-compute-hourly";
    case "data-retention": return "data-retention-daily";
    case "behavioral-email": return "behavioral-email-daily";
    case "weekly-challenge": return jobId === "cron-weekly-challenge-open" ? "weekly-challenge-open" : "weekly-challenge-close";
    case "news-fetch": return "news-fetch-cron";
    case "changelog-fetch": return "changelog-fetch-cron";
    case "daily-quiz": return "daily-quiz-seed";
    case "flashcard-reminder": return "flashcard-reminder-daily";
    default: return jobId;
  }
}

export async function registerCronJobs(): Promise<void> {
  logger.info("Registering cron jobs from DB");

  // Seed default jobs into DB if they don't exist yet
  for (const def of DEFAULT_JOBS) {
    await prisma.scheduledJob.upsert({
      where: { jobId: def.jobId },
      create: {
        jobId: def.jobId,
        name: def.name,
        description: def.description,
        queue: def.queue,
        cronPattern: def.cronPattern,
        payload: def.payload as object,
        active: true,
      },
      update: {},  // don't overwrite user edits
    });
  }

  await syncCronJobs();
  logger.info("Cron jobs registered");
}

export async function syncCronJobs(): Promise<void> {
  const dbJobs = await prisma.scheduledJob.findMany();

  for (const job of dbJobs) {
    const queue = getQueueByName(job.queue);
    if (!queue) {
      logger.warn({ jobId: job.jobId, queue: job.queue }, "syncCronJobs: unknown queue, skipping");
      continue;
    }

    const repeatables = await queue.getRepeatableJobs();
    const existing = repeatables.find((r) => r.id === job.jobId || r.name === getJobNameForQueue(job.queue, job.jobId));

    if (!job.active) {
      if (existing) {
        await queue.removeRepeatableByKey(existing.key);
        logger.info({ jobId: job.jobId }, "syncCronJobs: removed inactive job");
      }
      continue;
    }

    if (existing && existing.pattern === job.cronPattern) {
      continue;  // already registered with correct pattern
    }

    if (existing) {
      await queue.removeRepeatableByKey(existing.key);
    }

    const jobName = getJobNameForQueue(job.queue, job.jobId);
    const payload = (job.payload as Record<string, unknown>) ?? {};

    // Inject windowDays for feedback-analysis
    if (job.queue === "feedback-analysis" && !payload.windowDays) {
      payload.windowDays = config.worker.weakAreaWindowDays;
    }

    await queue.add(jobName, payload, {
      repeat: { pattern: job.cronPattern },
      jobId: job.jobId,
    });

    logger.info({ jobId: job.jobId, pattern: job.cronPattern }, "syncCronJobs: registered job");
  }
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
    if (sources.length > 0) {
      await prisma.workerTrigger.createMany({
        data: sources.map((src) => ({
          action: "fetch-sources",
          source: "cron",
          certificationPresetId: null,
        })),
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
    if (certs.length > 0) {
      await prisma.workerTrigger.createMany({
        data: certs.map((cert) => ({
          action: "analyze-feedback",
          source: "cron",
          certificationPresetId: cert.id,
        })),
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
    if (certs.length > 0) {
      await prisma.workerTrigger.createMany({
        data: certs.map((cert) => ({
          action: "generate",
          source: "cron",
          certificationPresetId: cert.id,
        })),
      });
    }
    logger.info({ count: certs.length }, "cron: question-generation expanded");
  }

  if (type === "performance-compute") {
    await performanceComputeQueue.add("hourly-compute", {});
    await prisma.workerTrigger.create({
      data: { action: "quality-scan", source: "cron" },
    });
    logger.info("cron: performance-compute enqueued");
  }
}
