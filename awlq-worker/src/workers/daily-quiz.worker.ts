import { Worker } from "bullmq";
import { redis, DailyQuizSeedJobData } from "../queues/index.js";
import { seedDailyQuiz } from "../services/daily-quiz-seeder.js";
import { logger } from "../shared/logger.js";

export function createDailyQuizWorker(): Worker {
  return new Worker<DailyQuizSeedJobData>(
    "daily-quiz",
    async () => {
      logger.info("daily-quiz: seeding today's quiz");
      await seedDailyQuiz();
      logger.info("daily-quiz: complete");
    },
    {
      connection: redis,
      concurrency: 1,
    },
  );
}
