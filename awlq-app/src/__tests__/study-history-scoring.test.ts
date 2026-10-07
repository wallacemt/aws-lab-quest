/**
 * Locks the option-shuffle scoring bug: questions are re-shuffled per serving
 * (mapDbQuestionToStudyQuestion), so a selected "display" letter must be
 * translated back to the canonical DB letter via optionMapping before being
 * compared against the DB's correctOption — otherwise scoring degrades to
 * near chance level (~1/n) for any session where the shuffle isn't identity.
 */
import { describe, expect, it } from "vitest";
import { isCorrectAnswer, isOptionKey } from "@/lib/study-answer-utils";
import { QuestionOption, QuestionOptionMapping } from "@/lib/types";

function toCanonicalOption(value: unknown, mapping: QuestionOptionMapping | undefined): QuestionOption | undefined {
  if (!isOptionKey(value)) return undefined;
  return mapping?.displayToOriginal?.[value] ?? value;
}

function toCanonicalOptions(value: unknown, mapping: QuestionOptionMapping | undefined): QuestionOption[] {
  if (!Array.isArray(value)) return [];
  const result: QuestionOption[] = [];
  for (const item of value) {
    const canonical = toCanonicalOption(item, mapping);
    if (canonical) result.push(canonical);
  }
  return result;
}

describe("study history scoring against DB gabarito after option shuffle", () => {
  it("counts a correct answer when the shuffled display letter maps back to the canonical correct option", () => {
    // Canonical correct option in DB is "A"; this session's shuffle displayed
    // the original "A" option under the letter "D".
    const mapping: QuestionOptionMapping = {
      displayToOriginal: { D: "A", A: "D" },
      originalToDisplay: { A: "D", D: "A" },
    };

    const isCorrect = isCorrectAnswer({
      questionType: "single",
      selectedOption: toCanonicalOption("D", mapping),
      selectedOptions: toCanonicalOptions(["D"], mapping),
      correctOption: "A",
      correctOptions: ["A"],
    });

    expect(isCorrect).toBe(true);
  });

  it("counts a wrong answer when the shuffled display letter does not map to the canonical correct option", () => {
    const mapping: QuestionOptionMapping = {
      displayToOriginal: { D: "A", A: "D" },
      originalToDisplay: { A: "D", D: "A" },
    };

    const isCorrect = isCorrectAnswer({
      questionType: "single",
      selectedOption: toCanonicalOption("A", mapping),
      selectedOptions: toCanonicalOptions(["A"], mapping),
      correctOption: "A",
      correctOptions: ["A"],
    });

    expect(isCorrect).toBe(false);
  });

  it("falls back to treating the selection as already canonical when no mapping is present", () => {
    const isCorrect = isCorrectAnswer({
      questionType: "single",
      selectedOption: toCanonicalOption("A", undefined),
      selectedOptions: toCanonicalOptions(["A"], undefined),
      correctOption: "A",
      correctOptions: ["A"],
    });

    expect(isCorrect).toBe(true);
  });
});
