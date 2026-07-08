import { describe, it, expect } from "vitest";
import { buildSprintPayload } from "@/features/retention/hooks/useSprint";
import { SprintQuestion } from "@/features/retention/services/retention-api";

function makeQuestion(id: string): SprintQuestion {
  return {
    id,
    statement: "stmt",
    topic: "iam",
    difficulty: "medium",
    questionType: "single",
    optionA: "a",
    optionB: "b",
    optionC: "c",
    optionD: "d",
    correctOption: "B",
  };
}

describe("buildSprintPayload", () => {
  it("sends selectedOption (not correct) and drops unanswered questions", () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    const payload = buildSprintPayload(questions, { q1: "A" });

    expect(payload).toEqual([{ questionId: "q1", selectedOption: "A" }]);
    expect(payload[0]).not.toHaveProperty("correct");
  });
});
