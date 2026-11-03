import { describe, expect, it } from "vitest";
import { fromHistorySnapshot, fromLiveSimulado } from "@/features/study/review/adapters";
import { filterReviewItems, buildReviewMetrics } from "@/features/study/review/review-filters";
import type { ReviewItem } from "@/features/study/review/types";
import type { StudyQuestion } from "@/lib/types";

const snapshot = (questionId: string, selectedOption: string, correctOptions = ["A"]) => ({
  questionId, statement: questionId, questionType: correctOptions.length > 1 ? "multi" as const : "single" as const,
  selectedOption, selectedOptions: selectedOption === "-" ? [] : [selectedOption], correctOption: "A", correctOptions,
  options: { A: "alpha", B: "beta" }, explanations: { A: "answer" },
});

describe("review adapters", () => {
  it("maps all outcomes and derives capabilities from live data", () => {
    const questions: StudyQuestion[] = ["correct", "partial", "wrong", "unanswered"].map((id) => ({
      id, statement: id, certificationCode: "SAA", topic: "IAM", difficulty: "easy" as const,
      questionType: id === "partial" ? "multi" as const : "single" as const,
      options: { A: "A", B: "B", C: "", D: "", E: "" }, correctOption: "A" as const,
      correctOptions: id === "partial" ? ["A", "B"] : ["A"], explanations: { A: "yes" },
    }));
    const { items, capabilities } = fromLiveSimulado({
      questions,
      answers: { correct: "A", partial: "A", wrong: "B", unanswered: undefined },
      timeSpentByQuestion: { correct: 2 }, confidenceByQuestion: { correct: "low" }, markedForReview: new Set(["correct"]),
    });
    expect(items.map((item) => item.outcome)).toEqual(["correct", "partial", "wrong", "unanswered"]);
    expect(capabilities).toEqual({ hasTiming: true, hasConfidence: true, hasMarked: true, hasTopics: true });
  });

  it("adapts historical snapshots, filters items, and builds metrics", () => {
    const { items } = fromHistorySnapshot([snapshot("a", "A"), snapshot("b", "B"), snapshot("c", "-"), snapshot("d", "A", ["A", "B"])], {
      id: "history", sessionType: "SIMULADO", title: "Simulado SAA", certificationCode: "SAA", completedAt: "today", durationSeconds: 30, scorePercent: 50, gainedXp: 10,
    });
    expect(items.map((item) => item.outcome)).toEqual(["correct", "wrong", "unanswered", "partial"]);
    const timed: ReviewItem[] = items.map((item, index) => ({ ...item, topic: index % 2 ? "EC2" : "IAM", timeSpentSeconds: [5, 10, 20, 40][index], markedForReview: index === 1 }));
    expect(filterReviewItems(timed, { outcome: "wrong", topic: "all", time: "all", confidence: "all", markedOnly: false })).toHaveLength(1);
    expect(buildReviewMetrics(timed).time).toEqual({ averageSeconds: 18.75, totalSeconds: 75, medianSeconds: 15 });
    expect(buildReviewMetrics(timed).outcomes.partial).toBe(1);
  });
});
