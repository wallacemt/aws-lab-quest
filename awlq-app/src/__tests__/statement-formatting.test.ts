import { describe, expect, it } from "vitest";
import { formatStatement } from "@/lib/statement-formatting";

describe("formatStatement", () => {
  it("extracts an embedded IAM policy and preserves the final question", () => {
    const before = "Um desenvolvedor escreve uma política: ";
    const policy = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow"}]}';
    const after = " O que o desenvolvedor deve fazer para registrar as invocações dessa função nos logs?";
    const segments = formatStatement(`${before}${policy}${after}`);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ type: "prose", text: before });
    expect(segments[1]).toEqual({ type: "code", language: "json", text: JSON.stringify(JSON.parse(policy), null, 2) });
    expect(segments[2]).toEqual({ type: "prose", text: after });
  });

  it("keeps plain statements as a single prose segment", () => {
    expect(formatStatement("Uma pergunta comum sem código.")).toEqual([
      { type: "prose", text: "Uma pergunta comum sem código." },
    ]);
  });

  it("formats a long CLI error as monospaced text", () => {
    const error = `A client error (UnauthorizedOperation) occurred when calling the RunInstances operation: ${"x".repeat(120)}`;
    expect(formatStatement(error)).toEqual([{ type: "code", language: "text", text: error }]);
  });
});
