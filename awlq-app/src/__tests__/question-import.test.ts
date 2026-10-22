import { describe, expect, it } from "vitest";
import { MAX_IMPORT_BYTES, parseQuestionJson, readQuestionFile, validateQuestionImport } from "@/lib/question-import";
const q = { statement: "Which service?", options: { A: "S3", B: "EC2" }, correctOption: "A" };
describe("shared JSON import validation", () => {
  it("accepts the existing array and envelope formats and BOM", () => {
    expect(parseQuestionJson(JSON.stringify([q]))).toEqual([q]);
    expect(parseQuestionJson("\uFEFF" + JSON.stringify({ questions: [q] }))).toEqual([q]);
  });
  it.each([null, {}, [], [null], [1], ["text"], Array(201).fill(q)].map(value => ({ value })))("rejects invalid roots/items: $value", ({ value }) => {
    expect(() => validateQuestionImport(value)).toThrow();
  });
  it.each([
    { statement: 12 }, { statement: " " }, { options: [] }, { options: { A: "x", Z: "y" } },
    { options: { A: " ", B: "b" } }, { correctOption: "C" }, { correctOptions: "A" },
    { correctOptions: ["A", "A"] }, { correctOptions: [] }, { correctOption: "B", correctOptions: ["A"] },
    { questionType: "essay" }, { questionType: "multi" }, { questionType: "single", correctOptions: ["A", "B"] },
    { difficulty: "invalid" }, { difficulty: ["easy"] }, { correctOptions: null }, { topic: {} }, { certificationCode: 5 },
    { awsServiceCodes: "S3" }, { awsServiceNames: [null] }, { explanations: [] }, { explanations: { Z: "x" } },
  ])("rejects malformed fields: %j", fields => {
    expect(() => validateQuestionImport([{ ...q, ...fields }])).toThrow("Item 1");
  });
  it("accepts multi-answer questions with explanations and service metadata", () => {
    expect(validateQuestionImport([{ ...q, correctOptions: ["A", "B"], questionType: "multi", difficulty: "nightmare", explanations: { A: "reason" }, awsServiceNames: ["Amazon S3"] }])).toHaveLength(1);
  });
  it("reports every invalid item before persisting", () => {
    expect(() => validateQuestionImport([null, {}])).toThrow(/Item 1[\s\S]*Item 2/);
  });
  it("rejects syntax errors and oversized content", () => {
    expect(() => parseQuestionJson("{" )).toThrow("JSON inválido");
    expect(() => parseQuestionJson(" ".repeat(MAX_IMPORT_BYTES + 1))).toThrow("2 MB");
  });
  it("reads a JSON file and rejects wrong extension or excessive size before reading", async () => {
    const file = { name: "questions.JSON", size: 100, text: async () => JSON.stringify([q]) } as File;
    expect(await readQuestionFile(file)).toEqual([q]);
    await expect(readQuestionFile({ ...file, name: "questions.txt" } as File)).rejects.toThrow(".json");
    await expect(readQuestionFile({ ...file, size: MAX_IMPORT_BYTES + 1 } as File)).rejects.toThrow("2 MB");
  });
});
