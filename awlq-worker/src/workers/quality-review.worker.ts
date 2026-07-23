import { Worker } from "bullmq";
import { connection, QualityReviewJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { callAI } from "../ai.js";
import { extractJsonObject } from "../shared/ingestion-pipeline.js";
import { logger } from "../shared/logger.js";

type ReviewAction = "improve" | "retire";

type ImprovedQuestion = {
  statement: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanationA?: string;
  explanationB?: string;
  explanationC?: string;
  explanationD?: string;
};

type ReviewResult = {
  action: ReviewAction;
  improved?: ImprovedQuestion;
  reviewNote: string;
};

async function reviewQuestionWithAI(
  question: {
    statement: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
  },
  flagReason: string,
  correctRate: number,
  reportCount: number
): Promise<ReviewResult | null> {
  const prompt = `You are an AWS certification exam quality reviewer.

QUESTION TO REVIEW:
${question.statement}

Options:
A) ${question.optionA}
B) ${question.optionB}
C) ${question.optionC}
D) ${question.optionD}
Correct: ${question.correctOption}

QUALITY ISSUE: ${flagReason}
METRICS: correctRate=${(correctRate * 100).toFixed(1)}%, reportCount=${reportCount}

TASK:
- Analyze why this question has a quality issue.
- If improvable: rewrite it to fix the issue while keeping the same AWS concept.
- If unfixable (fundamentally flawed, misleading, or incorrect): mark for retirement.

Return ONLY valid JSON:
{
  "action": "improve",
  "improved": {
    "statement": "string",
    "optionA": "string",
    "optionB": "string",
    "optionC": "string",
    "optionD": "string",
    "correctOption": "A|B|C|D",
    "explanationA": "string",
    "explanationB": "string",
    "explanationC": "string",
    "explanationD": "string"
  },
  "reviewNote": "string explaining the decision"
}

OR if retiring:
{
  "action": "retire",
  "reviewNote": "string explaining why it cannot be saved"
}`;

  try {
    const response = await callAI(prompt, "WORKER_QUALITY_REVIEW");
    const jsonStr = extractJsonObject(response);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr) as ReviewResult;
    if (parsed.action !== "improve" && parsed.action !== "retire") return null;
    return parsed;
  } catch (err) {
    logger.error({ err }, "quality-review: AI call failed");
    return null;
  }
}

export function createQualityReviewWorker(): Worker {
  return new Worker<QualityReviewJobData>(
    "quality-review",
    async (job) => {
      const { questionId, flagReason, correctRate, reportCount } = job.data;

      logger.info({ questionId, flagReason }, "quality-review: starting");

      const question = await prisma.studyQuestion.findUnique({
        where: { id: questionId },
        select: {
          id: true,
          statement: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          correctOption: true,
          active: true,
        },
      });

      if (!question || !question.active) {
        logger.info({ questionId }, "quality-review: question not found or inactive, skipping");
        return;
      }

      const review = await reviewQuestionWithAI(question, flagReason, correctRate, reportCount);

      if (!review) {
        logger.warn({ questionId }, "quality-review: AI returned no valid result");
        return;
      }

      const reviewedAt = new Date();

      if (review.action === "retire") {
        await prisma.studyQuestion.update({
          where: { id: questionId },
          data: { active: false },
        });
        await prisma.questionPerformance.update({
          where: { questionId },
          data: { reviewResult: "retired", reviewedAt, flaggedForReview: false },
        });
        logger.info({ questionId, note: review.reviewNote }, "quality-review: question retired");
      } else if (review.action === "improve" && review.improved) {
        const imp = review.improved;
        const correctOption = imp.correctOption?.trim().toUpperCase();
        if (!["A", "B", "C", "D"].includes(correctOption)) {
          // AI hallucinated a malformed/out-of-range letter for its own rewritten
          // options — applying it would silently corrupt scoring, so skip the
          // improvement entirely rather than trust an unverifiable answer key.
          logger.warn({ questionId, correctOption: imp.correctOption }, "quality-review: invalid correctOption, skipping improvement");
          return;
        }
        await prisma.studyQuestion.update({
          where: { id: questionId },
          data: {
            statement: imp.statement,
            optionA: imp.optionA,
            optionB: imp.optionB,
            optionC: imp.optionC,
            optionD: imp.optionD,
            correctOption,
            explanationA: imp.explanationA ?? null,
            explanationB: imp.explanationB ?? null,
            explanationC: imp.explanationC ?? null,
            explanationD: imp.explanationD ?? null,
            // Reset cached AI explanations so they get regenerated
            cachedExplainSummary: null,
            cachedExplainA: null,
            cachedExplainB: null,
            cachedExplainC: null,
            cachedExplainD: null,
            cachedExplainAt: null,
          },
        });
        await prisma.questionPerformance.update({
          where: { questionId },
          data: { reviewResult: "improved", reviewedAt, flaggedForReview: false },
        });
        logger.info({ questionId }, "quality-review: question improved");
      }
    },
    {
      connection,
      concurrency: 1,
      limiter: { max: 5, duration: 60_000 },
    }
  );
}
