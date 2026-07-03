import { Worker } from "bullmq";
import { connection, KcGenerationJobData } from "../queues/index.js";
import { buildKcQuestions } from "../services/kc-question-builder.js";
import { logger } from "../shared/logger.js";

export function createKcGenerationWorker(): Worker {
  return new Worker<KcGenerationJobData>(
    "kc-generation",
    async (job) => {
      const { requestId, userId, certificationPresetId, serviceCode, topic, difficulty, count } = job.data;

      logger.info({ requestId, userId, serviceCode, topic, difficulty, count }, "kc-generation: starting");

      const result = await buildKcQuestions({ requestId, userId, certificationPresetId, serviceCode, topic, difficulty, count });

      logger.info({ requestId, ...result }, "kc-generation: complete");
    },
    {
      connection,
      // Low concurrency — each job makes a Gemini call; the rate limiter in ai.ts
      // serializes them, but cap concurrency to avoid memory pressure.
      concurrency: 2,
    },
  );
}
