import { describe, expect, it } from "vitest";
import { filterReviewItems, buildReviewMetrics } from "@/features/study/review/review-filters";
import type { ReviewFilters, ReviewItem } from "@/features/study/review/types";

const items: ReviewItem[] = [
  { questionId: "q1", index: 0, topic: "IAM", statement: "q1", questionType: "single", outcome: "correct", timeSpentSeconds: 5, confidence: "low", markedForReview: false, options: [], flashcardSeed: { questionId: "q1", statement: "q1", correctOptionsText: [] } },
  { questionId: "q2", index: 1, topic: "EC2", statement: "q2", questionType: "single", outcome: "correct", timeSpentSeconds: 20, confidence: "high", markedForReview: true, options: [], flashcardSeed: { questionId: "q2", statement: "q2", correctOptionsText: [] } },
  { questionId: "q3", index: 2, topic: "IAM", statement: "q3", questionType: "single", outcome: "wrong", timeSpentSeconds: 45, confidence: "high", markedForReview: true, options: [], flashcardSeed: { questionId: "q3", statement: "q3", correctOptionsText: [] } },
];
const base: ReviewFilters = { outcome: "all", topic: "all", time: "all", markedOnly: false, confidence: "all" };

describe("simulado review filters", () => {
  const filter = (filters: Partial<ReviewFilters> = {}, list = items) => filterReviewItems(list, { ...base, ...filters });

  it("supports each filter independently", () => {
    expect(filter({ outcome: "correct" }).map(({ questionId }) => questionId)).toEqual(["q1", "q2"]);
    expect(filter({ topic: "IAM" }).map(({ questionId }) => questionId)).toEqual(["q1", "q3"]);
    expect(filter({ time: "fast" }).map(({ questionId }) => questionId)).toEqual(["q1"]);
    expect(filter({ time: "slow" }).map(({ questionId }) => questionId)).toEqual(["q3"]);
    expect(filter({ markedOnly: true }).map(({ questionId }) => questionId)).toEqual(["q2", "q3"]);
    expect(filter({ confidence: "false-belief" }).map(({ questionId }) => questionId)).toEqual(["q3"]);
    expect(filter({ confidence: "lucky-guess" }).map(({ questionId }) => questionId)).toEqual(["q1"]);
  });

  it("combines filters and handles empty/no-filter cases", () => {
    expect(filter({ markedOnly: true, topic: "IAM", outcome: "wrong" }).map(({ questionId }) => questionId)).toEqual(["q3"]);
    expect(filter()).toEqual(items);
    expect(filter({}, [])).toEqual([]);
  });

  it("calculates outcomes, topic performance, and time metrics", () => {
    expect(buildReviewMetrics(items).time).toEqual({ averageSeconds: 70 / 3, totalSeconds: 70, medianSeconds: 20 });
    expect(buildReviewMetrics(items).outcomes.wrong).toBe(1);
    expect(buildReviewMetrics(items).topics.find(({ topic }) => topic === "IAM")?.attempts).toBe(2);
  });
});
