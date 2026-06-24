import { Worker } from "bullmq";
import { redis, MentorComputeJobData } from "../queues/index.js";
import { computeMentorRecommendations } from "../services/mentor-recommender.js";
import { logger } from "../shared/logger.js";

export function createMentorComputeWorker(): Worker {
  return new Worker<MentorComputeJobData>(
    "mentor-compute",
    async (job) => {
      const { userId } = job.data;

      logger.info({ userId }, "mentor-compute: starting");

      await computeMentorRecommendations(userId);

      logger.info({ userId }, "mentor-compute: complete");
    },
    {
      connection: redis,
      concurrency: 10,
    },
  );
}
