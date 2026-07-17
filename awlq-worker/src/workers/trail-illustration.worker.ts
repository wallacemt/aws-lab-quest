import { Worker } from "bullmq";
import { connection, TrailIllustrationJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";
import {
  generateStageIllustrationPrompt,
  fetchPollinationsImage,
  uploadStageIllustration,
} from "../services/trail-illustration.js";

export function createTrailIllustrationWorker(): Worker {
  return new Worker<TrailIllustrationJobData>(
    "trail-illustration",
    async (job) => {
      const { stageId } = job.data;

      const stage = await prisma.questChainStage.findUnique({
        where: { id: stageId },
        select: {
          id: true,
          title: true,
          topic: true,
          awsServiceId: true,
          imageUrl: true,
          chain: { select: { name: true } },
        },
      });

      if (!stage) {
        logger.info({ stageId }, "trail-illustration: stage not found, skipping");
        return;
      }

      // Cached — never regenerate once a stage already has an illustration.
      if (stage.imageUrl) {
        logger.info({ stageId }, "trail-illustration: already has imageUrl, skipping");
        return;
      }

      logger.info({ stageId }, "trail-illustration: starting");

      const prompt = await generateStageIllustrationPrompt({
        stageId: stage.id,
        title: stage.title,
        topic: stage.topic,
        awsServiceId: stage.awsServiceId,
        chainName: stage.chain.name,
      });

      const seed = Math.floor(Math.random() * 999_999);
      const { buffer, mimeType } = await fetchPollinationsImage(prompt, seed);
      const imageUrl = await uploadStageIllustration(buffer, mimeType, stage.id);

      await prisma.questChainStage.update({
        where: { id: stageId },
        data: { imageUrl },
      });

      logger.info({ stageId, imageUrl }, "trail-illustration: done");
    },
    {
      connection,
      concurrency: 1,
      limiter: { max: 5, duration: 60_000 },
    }
  );
}
