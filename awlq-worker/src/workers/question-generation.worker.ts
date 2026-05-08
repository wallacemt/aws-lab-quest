import { Worker } from "bullmq";
import { redis, QuestionGenerationJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { generateAndPersistQuestions } from "../services/question-builder.js";
import { logger } from "../shared/logger.js";

export function createQuestionGenerationWorker(): Worker {
  return new Worker<QuestionGenerationJobData>(
    "question-generation",
    async (job) => {
      const data = job.data;

      logger.info(
        {
          cert: data.certificationCode,
          trigger: data.triggerType,
          target: data.targetCount,
          domains: data.domains.length,
        },
        "question-generation: starting"
      );

      const result = await generateAndPersistQuestions({
        certificationPresetId: data.certificationPresetId,
        certificationCode: data.certificationCode,
        certificationName: data.certificationName,
        domains: data.domains,
        totalTarget: data.targetCount,
        difficulty: data.difficulty,
        triggerType: data.triggerType,
        weakAreaFilter: data.weakAreaFilter,
      });

      // Update generatedQuestionCount on IngestionSource (if triggered from source-fetch)
      if (data.triggerType === "scheduled") {
        const sources = await prisma.ingestionSource.findMany({
          where: { certificationPresetId: data.certificationPresetId, status: "COMPLETED" },
          select: { id: true, generatedQuestionCount: true },
          take: 1,
        });
        if (sources[0]) {
          await prisma.ingestionSource.update({
            where: { id: sources[0].id },
            data: {
              generatedQuestionCount: sources[0].generatedQuestionCount + result.savedCount,
            },
          });
        }
      }

      logger.info(
        { cert: data.certificationCode, ...result },
        "question-generation: done"
      );
    },
    {
      connection: redis,
      concurrency: 1,
      limiter: { max: 3, duration: 60_000 },
    }
  );
}
