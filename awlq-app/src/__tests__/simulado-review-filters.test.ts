import { describe, expect, it } from "vitest";
import { filterSimuladoReviewQuestions, getAverageQuestionTime, hasSubstantialStaticExplanation } from "@/features/utils/funcs/simulado-utils";
import type { SimuladoReviewFilters } from "@/features/utils/funcs/simulado-utils";
import type { StudyQuestion } from "@/lib/types";

const question = (id: string, topic: string, correctOption: "A" | "B" = "A"): StudyQuestion => ({
  id, topic, statement: id, certificationCode: "SAA", difficulty: "easy", questionType: "single",
  options: { A: "A", B: "B", C: "C", D: "D", E: "E" }, correctOption, correctOptions: [correctOption], explanations: {},
});

const questions = [question("q1", "IAM"), question("q2", "EC2"), question("q3", "IAM", "B")];
const answers = { q1: "A" as const, q2: "A" as const, q3: "A" as const };
const times = { q1: 5, q2: 20, q3: 45 };
const marked = new Set(["q2", "q3"]);
const confidence = { q1: "low" as const, q2: "high" as const, q3: "high" as const };
const base: SimuladoReviewFilters = { result: "all", topic: "all", time: "all", markedOnly: false, confidence: "all" };

describe("simulado review filters", () => {
  const filter = (filters: Partial<SimuladoReviewFilters> = {}, list = questions) => filterSimuladoReviewQuestions(list, answers, times, marked, confidence, { ...base, ...filters });

  it("supports each filter independently", () => {
    expect(filter({ result: "correct" }).map(({ id }) => id)).toEqual(["q1", "q2"]);
    expect(filter({ topic: "IAM" }).map(({ id }) => id)).toEqual(["q1", "q3"]);
    expect(filter({ time: "fast" }).map(({ id }) => id)).toEqual(["q1"]);
    expect(filter({ time: "slow" }).map(({ id }) => id)).toEqual(["q3"]);
    expect(filter({ markedOnly: true }).map(({ id }) => id)).toEqual(["q2", "q3"]);
    expect(filter({ confidence: "false-belief" }).map(({ id }) => id)).toEqual(["q3"]);
    expect(filter({ confidence: "lucky-guess" }).map(({ id }) => id)).toEqual(["q1"]);
  });

  it("combines filters and handles empty/no-filter cases", () => {
    expect(filter({ markedOnly: true, topic: "IAM", result: "wrong" }).map(({ id }) => id)).toEqual(["q3"]);
    expect(filter()).toEqual(questions);
    expect(filter({}, [])).toEqual([]);
  });

  it("calculates average time and only skips AI for a substantial static explanation", () => {
    expect(getAverageQuestionTime(questions, times)).toBe(70 / 3);
    expect(getAverageQuestionTime([], {})).toBe(0);
    expect(hasSubstantialStaticExplanation(` ${"x".repeat(40)} `)).toBe(true);
    expect(hasSubstantialStaticExplanation("x".repeat(39))).toBe(false);
    expect(hasSubstantialStaticExplanation(undefined)).toBe(false);
  });
});
