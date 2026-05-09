import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.redis.url, { maxRetriesPerRequest: null });

const connection = redis;

// ─── Job data types ───────────────────────────────────────────────────────────

export type SourceFetchJobData = {
  ingestionSourceId: string;
  url: string;
  certificationCode: string;
  force?: boolean;
};

export type QuestionGenerationJobData = {
  certificationPresetId: string;
  certificationCode: string;
  certificationName: string;
  triggerType: "scheduled" | "weak_area" | "manual";
  domains: Array<{
    domainName: string;
    weightPercent: number;
    subTopics: string[];
  }>;
  targetCount: number;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  weakAreaFilter?: {
    serviceCode?: string;
    topicName?: string;
    targetCorrectRate: number;
  };
};

export type FeedbackAnalysisJobData = {
  certificationPresetId: string;
  certificationCode: string;
  windowDays: number;
};

export type PerformanceComputeJobData = {
  certificationPresetId?: string;
  forceRecompute?: boolean;
};

export type QualityReviewJobData = {
  questionId: string;
  flagReason: "too_easy" | "too_hard" | "high_report_rate" | "poor_discrimination";
  correctRate: number;
  reportCount: number;
};

// ─── Queues ───────────────────────────────────────────────────────────────────

export const sourceFetchQueue = new Queue<SourceFetchJobData, void, string>("source-fetch", { connection });

export const questionGenerationQueue = new Queue<QuestionGenerationJobData, void, string>("question-generation", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10_000 },
  },
});

export const feedbackAnalysisQueue = new Queue<FeedbackAnalysisJobData, void, string>("feedback-analysis", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
  },
});

export const performanceComputeQueue = new Queue<PerformanceComputeJobData, void, string>("performance-compute", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 2_000 },
  },
});

export const qualityReviewQueue = new Queue<QualityReviewJobData, void, string>("quality-review", {
  connection,
  defaultJobOptions: {
    attempts: 1,
    backoff: { type: "fixed", delay: 30_000 },
  },
});
