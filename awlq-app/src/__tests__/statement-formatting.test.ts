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

  it("ends a CLI error before the Portuguese follow-up question", () => {
    const blob = "A".repeat(100);
    const question = " Como o desenvolvedor pode decodificar a resposta?";
    const segments = formatStatement(`Mensagem de falha codificada: ${blob}${question}`);

    expect(segments).toEqual([
      { type: "prose", text: "Mensagem de falha codificada: " },
      { type: "code", language: "text", text: blob },
      { type: "prose", text: question },
    ]);
  });

  it("formats an embedded CloudFormation YAML template", () => {
    const template = "Resources:\n  Bucket:\n    Type: AWS::S3::Bucket";
    expect(formatStatement(`Implante este recurso:\n${template}\nQual recurso foi criado?`)).toEqual([
      { type: "prose", text: "Implante este recurso:\n" },
      { type: "code", language: "text", text: template },
      { type: "prose", text: "Qual recurso foi criado?" },
    ]);
  });

  it("formats embedded AWS CLI commands", () => {
    const command = "aws s3 ls s3://meu-bucket";
    expect(formatStatement(`Execute o comando:\n${command}\nDepois verifique a saída.`)).toEqual([
      { type: "prose", text: "Execute o comando:\n" },
      { type: "code", language: "text", text: command },
      { type: "prose", text: "Depois verifique a saída." },
    ]);
  });
});
