import { Worker } from "bullmq";
import { redis, FlashcardGenerationJobData } from "../queues/index.js";
import { generateFlashcardsForUser } from "../services/flashcard-generator.js";
import { logger } from "../shared/logger.js";

export function createFlashcardGenerationWorker(): Worker {
  return new Worker<FlashcardGenerationJobData>(
    "flashcard-generation",
    async (job) => {
      const { userId, sinceSessionId } = job.data;

      logger.info({ userId, sinceSessionId }, "flashcard-generation: starting");

      const created = await generateFlashcardsForUser(userId, sinceSessionId);

      logger.info({ userId, created }, "flashcard-generation: complete");
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );
}
