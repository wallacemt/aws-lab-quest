import { Worker } from "bullmq";
import { connection, TrailReviewJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { callAI } from "../ai.js";
import { extractJsonObject } from "../shared/ingestion-pipeline.js";
import { logger } from "../shared/logger.js";

type ReviewResult = {
  markdown: string;
  changed: boolean;
  reviewNote: string;
};

async function reviewExplainWithAI(
  explain: { markdown: string },
  stage: { title: string; topic: string | null; awsServiceId: string | null; chainName: string }
): Promise<ReviewResult | null> {
  const subject = stage.awsServiceId ?? stage.topic ?? stage.title;

  const prompt = `You are an AWS certification content quality reviewer.

STAGE: "${stage.title}" (${subject}), trail "${stage.chainName}"

EXPLANATION TO REVIEW (Markdown, pt-BR):
${explain.markdown}

TASK:
- Review the explanation for clarity, completeness and technical correctness.
- Fix any factual errors about the AWS service/concept.
- Improve structure and clarity where it helps a student studying for the certification, keeping the existing section headings and pt-BR language.
- If the explanation is already good, return it unchanged and set "changed" to false.

Return ONLY valid JSON:
{
  "markdown": "the reviewed (or unchanged) markdown, pt-BR",
  "changed": true,
  "reviewNote": "string explaining what was fixed, or why nothing changed"
}`;

  try {
    const response = await callAI(prompt, "WORKER_TRAIL_REVIEW");
    const jsonStr = extractJsonObject(response);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr) as ReviewResult;
    if (typeof parsed.markdown !== "string" || !parsed.markdown.trim()) return null;
    return parsed;
  } catch (err) {
    logger.error({ err }, "trail-review: AI call failed");
    return null;
  }
}

export function createTrailReviewWorker(): Worker {
  return new Worker<TrailReviewJobData>(
    "trail-review",
    async (job) => {
      const { stageId } = job.data;

      logger.info({ stageId }, "trail-review: starting");

      const stage = await prisma.questChainStage.findUnique({
        where: { id: stageId },
        select: {
          title: true,
          topic: true,
          awsServiceId: true,
          chain: { select: { name: true } },
          explain: { select: { markdown: true } },
        },
      });

      if (!stage?.explain) {
        logger.info({ stageId }, "trail-review: stage or explain not found, skipping");
        return;
      }

      const review = await reviewExplainWithAI(stage.explain, {
        title: stage.title,
        topic: stage.topic,
        awsServiceId: stage.awsServiceId,
        chainName: stage.chain.name,
      });

      if (!review) {
        logger.warn({ stageId }, "trail-review: AI returned no valid result");
        return;
      }

      if (!review.changed) {
        logger.info({ stageId, note: review.reviewNote }, "trail-review: no changes needed");
        return;
      }

      await prisma.trailStageExplain.update({
        where: { stageId },
        data: { markdown: review.markdown },
      });

      logger.info({ stageId, note: review.reviewNote }, "trail-review: explanation improved");
    },
    {
      connection,
      concurrency: 1,
      limiter: { max: 5, duration: 60_000 },
    }
  );
}
