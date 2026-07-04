import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.redis.url, { maxRetriesPerRequest: null });

// Cast needed: bun resolves bullmq's pinned ioredis@5.10.1 separately from workspace
// ioredis@5.11.1, making the types structurally incompatible despite being identical at runtime.
export const connection: ConnectionOptions = redis as unknown as ConnectionOptions;

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

export type EmailSendJobData = {
  templateId: string;
  targetMode: "all-users" | "single-user";
  userId?: string;
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

export const emailSendQueue = new Queue<EmailSendJobData, void, string>("email-send", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
  },
});

export const dataRetentionQueue = new Queue<Record<string, never>, void, string>("data-retention", {
  connection,
  defaultJobOptions: {
    attempts: 1,
  },
});

export type BehavioralEmailJobData =
  | { mode: "analyze" }
  | { mode: "send"; userId: string; triggerCode: "churn_risk" | "streak_milestone" | "score_improvement" | "score_slump" };

export const behavioralEmailQueue = new Queue<BehavioralEmailJobData, void, string>("behavioral-email", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10_000 },
  },
});

// ─── Phase 1: Retention queues ────────────────────────────────────────────────

export type FlashcardGenerationJobData = {
  userId: string;
  sinceSessionId?: string;
};

export const flashcardGenerationQueue = new Queue<FlashcardGenerationJobData, void, string>("flashcard-generation", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
  },
});

// ─── Phase 1.5: KC generation queue ──────────────────────────────────────────

export type KcGenerationJobData = {
  requestId: string;
  userId: string;
  certificationPresetId?: string;
  serviceCode?: string;
  topic?: string;
  difficulty: "easy" | "medium" | "hard" | "nightmare";
  count: number;
};

export const kcGenerationQueue = new Queue<KcGenerationJobData, void, string>("kc-generation", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10_000 },
  },
});

// ─── Phase 2: Mentor compute queue ───────────────────────────────────────────

export type MentorComputeJobData = { userId: string };

export const mentorComputeQueue = new Queue<MentorComputeJobData, void, string>("mentor-compute", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
  },
});

// ─── Phase 4: Engagement queues ───────────────────────────────────────────────

export type WeeklyChallengeJobData = { mode: "open" | "close" };

export const weeklyChallengeQueue = new Queue<WeeklyChallengeJobData, void, string>("weekly-challenge", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
  },
});

export type NewsFetchJobData = { sourceId?: string };

export const newsFetchQueue = new Queue<NewsFetchJobData, void, string>("news-fetch", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 10_000 },
  },
});

export type ChangelogFetchJobData = { manual?: boolean };

export const changelogFetchQueue = new Queue<ChangelogFetchJobData, void, string>("changelog-fetch", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10_000 },
  },
});

export type DailyQuizSeedJobData = Record<string, never>;

export const dailyQuizQueue = new Queue<DailyQuizSeedJobData, void, string>("daily-quiz", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
  },
});

// ─── Issue #22: flashcard due-card email reminders ───────────────────────────

export type FlashcardReminderJobData = Record<string, never>;

export const flashcardReminderQueue = new Queue<FlashcardReminderJobData, void, string>("flashcard-reminder", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
  },
});
