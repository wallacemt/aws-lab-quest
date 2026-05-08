import "dotenv/config";
import { config } from "./config.js";
import { logger } from "./shared/logger.js";
import { redis } from "./queues/index.js";
import { createSourceFetchWorker } from "./workers/source-fetch.worker.js";
import { createQuestionGenerationWorker } from "./workers/question-generation.worker.js";
import { createFeedbackAnalysisWorker } from "./workers/feedback-analysis.worker.js";
import { createPerformanceComputeWorker } from "./workers/performance-compute.worker.js";
import { createQualityReviewWorker } from "./workers/quality-review.worker.js";
import { registerCronJobs, expandCronJob } from "./cron/scheduler.js";
import { startTriggerPoller } from "./services/trigger-poller.js";
import { prisma } from "./prisma.js";

// Suppress unused variable warning — config is validated on import
void config;

async function main() {
  logger.info("aws-quest-worker starting");

  // Verify Redis connection
  await redis.ping();
  logger.info("Redis connected");

  // Verify DB connection
  await prisma.$queryRaw`SELECT 1`;
  logger.info("Database connected");

  // Register all BullMQ workers
  const workers = [
    createSourceFetchWorker(),
    createQuestionGenerationWorker(),
    createFeedbackAnalysisWorker(),
    createPerformanceComputeWorker(),
    createQualityReviewWorker(),
  ];

  for (const worker of workers) {
    worker.on("failed", (job, err) => {
      logger.error({ queue: worker.name, jobId: job?.id, err }, "Job failed");
    });
    worker.on("error", (err) => {
      logger.error({ queue: worker.name, err }, "Worker error");
    });
  }

  // Handle cron sentinel jobs: expand into real per-cert/source jobs
  workers[0]!.on("completed", async (job) => {
    if (job.name === "source-fetch-daily") {
      await expandCronJob("source-fetch", false);
    }
    if (job.name === "source-fetch-weekly-force") {
      await expandCronJob("source-fetch", true);
    }
  });

  workers[2]!.on("completed", async (job) => {
    if (job.name === "feedback-analysis-daily") {
      await expandCronJob("feedback-analysis");
    }
  });

  workers[1]!.on("completed", async (job) => {
    if (job.name === "question-generation-scheduled") {
      await expandCronJob("question-generation");
    }
  });

  workers[3]!.on("completed", async (job) => {
    if (job.name === "performance-compute-hourly") {
      await expandCronJob("performance-compute");
    }
  });

  // Register recurring cron jobs in BullMQ
  await registerCronJobs();

  // Poll WorkerTrigger table for manual triggers from the admin UI
  startTriggerPoller();

  logger.info("aws-quest-worker ready — all workers and cron jobs active");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown initiated");
    for (const worker of workers) {
      await worker.close();
    }
    await redis.quit();
    await prisma.$disconnect();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
