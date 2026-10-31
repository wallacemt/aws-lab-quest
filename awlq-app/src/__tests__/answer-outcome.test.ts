import { describe, expect, it } from "vitest";
import { getAnswerOutcome, isCorrectAnswer } from "@/lib/study-answer-utils";

describe("getAnswerOutcome", () => {
  it("keeps correctness identical to isCorrectAnswer across relevant inputs", () => {
    const answers = [undefined, "-", "A", "B", ["A"], ["A", "B"], ["B", "C"], [], ["Z"]];
    for (const questionType of ["single", "multi"] as const) {
      for (const selected of answers) {
        for (const correctOptions of [undefined, ["A"], ["A", "B"]]) {
          const params = { questionType, selectedOption: selected, selectedOptions: selected, correctOption: "A", correctOptions };
          expect(isCorrectAnswer(params)).toBe(getAnswerOutcome(params) === "correct");
        }
      }
    }
  });

  it("distinguishes unanswered and partial multi-select answers", () => {
    expect(getAnswerOutcome({ questionType: "single", selectedOption: "-", correctOption: "A" })).toBe("unanswered");
    expect(getAnswerOutcome({ questionType: "multi", selectedOptions: ["A"], correctOptions: ["A", "B"] })).toBe("partial");
  });
});
