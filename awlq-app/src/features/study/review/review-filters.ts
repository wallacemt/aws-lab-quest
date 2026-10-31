import type { ReviewFilters, ReviewItem } from "./types";

export function filterReviewItems(items: ReviewItem[], filters: ReviewFilters): ReviewItem[] {
  const timed = items.flatMap((item) => item.timeSpentSeconds === undefined ? [] : [item.timeSpentSeconds]);
  const average = timed.length ? timed.reduce((sum, value) => sum + value, 0) / timed.length : 0;
  return items.filter((item) => {
    const falseBelief = item.outcome !== "correct" && item.confidence === "high";
    const luckyGuess = item.outcome === "correct" && item.confidence === "low";
    return (filters.outcome === "all" || item.outcome === filters.outcome) &&
      (filters.topic === "all" || (item.topic?.trim() || "OUTROS") === filters.topic) &&
      (filters.time === "all" || (filters.time === "fast" ? (item.timeSpentSeconds ?? 0) < average * 0.5 : (item.timeSpentSeconds ?? 0) > average * 1.5)) &&
      (filters.confidence === "all" || (filters.confidence === "false-belief" ? falseBelief : luckyGuess)) &&
      (!filters.markedOnly || item.markedForReview === true);
  });
}

export function buildReviewMetrics(items: ReviewItem[]) {
  const times = items.flatMap((item) => item.timeSpentSeconds === undefined ? [] : [item.timeSpentSeconds]).sort((a, b) => a - b);
  const topicMap = new Map<string, { topic: string; attempts: number; correct: number; partial: number; wrong: number; unanswered: number; accuracyPercent: number }>();
  const outcomes = { correct: 0, partial: 0, wrong: 0, unanswered: 0 };
  for (const item of items) {
    outcomes[item.outcome] += 1;
    const topic = item.topic?.trim() || "OUTROS";
    const current = topicMap.get(topic.toUpperCase()) ?? { topic, attempts: 0, correct: 0, partial: 0, wrong: 0, unanswered: 0, accuracyPercent: 0 };
    current.attempts += 1;
    current[item.outcome] += 1;
    current.accuracyPercent = Math.round((current.correct / current.attempts) * 100);
    topicMap.set(topic.toUpperCase(), current);
  }
  return {
    outcomes,
    time: times.length ? {
      averageSeconds: times.reduce((sum, value) => sum + value, 0) / times.length,
      totalSeconds: times.reduce((sum, value) => sum + value, 0),
      medianSeconds: times.length % 2 ? times[Math.floor(times.length / 2)] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2,
    } : null,
    topics: Array.from(topicMap.values()),
  };
}
