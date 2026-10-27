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

  it("formats the reported IAM policy question and preserves its trailing question", () => {
    const statement = `Um desenvolvedor está criando um aplicativo web que processa e monitora votos. Um dispositivo de votação envia os votos a um bucket do Amazon S3 chamado DOC-EXAMPLE-BUCKET. O aplicativo precisa registrar os votos em uma tabela do Amazon DynamoDB chamada Example. O desenvolvedor escreve uma função do AWS Lambda para processar os objetos. Ele escreve a seguinte política para a função de execução da função do Lambda: {     "Version": "2012-10-17",     "Statement": [         {             "Effect": "Allow",             "Action": [                 "s3:GetObject",                 "dynamodb:PutItem",                 "dynamodb:UpdateItem"             ],             "Resource": [                 "arn:aws:dynamodb:us-west-2:XXXXXXXXXXXX:table/Example",                 "arn:aws:s3:::DOC-EXAMPLE-BUCKET/*"             ]         }     ] } O desenvolvedor executou um teste bem-sucedido na função do Lambda. No entanto, ele não conseguiu encontrar um registro da invocação nos logs. O que ele deve fazer para registrar as invocações dessa função nos logs?`;
    const segments = formatStatement(statement);

    expect(segments).toHaveLength(3);
    expect(segments[1]).toMatchObject({ type: "code", language: "json" });
    expect(segments[1].text).toContain('"dynamodb:PutItem"');
    expect(segments[2].text).toBe(" O desenvolvedor executou um teste bem-sucedido na função do Lambda. No entanto, ele não conseguiu encontrar um registro da invocação nos logs. O que ele deve fazer para registrar as invocações dessa função nos logs?");
  });

  it("normalizes typographic quotes and non-breaking spaces in embedded JSON", () => {
    const segments = formatStatement('Política: { “Version”: “2012-10-17”, “Statement”: []} Fim do enunciado.');

    expect(segments).toEqual([
      { type: "prose", text: "Política: " },
      { type: "code", language: "json", text: '{\n  "Version": "2012-10-17",\n  "Statement": []\n}' },
      { type: "prose", text: " Fim do enunciado." },
    ]);
  });

  it("keeps a balanced malformed container as code and continues parsing afterward", () => {
    const segments = formatStatement('Texto {“chave”: sem aspas} e depois {"ok": true} fim.');

    expect(segments).toEqual([
      { type: "prose", text: "Texto " },
      { type: "code", language: "text", text: '{“chave”: sem aspas}' },
      { type: "prose", text: " e depois " },
      { type: "code", language: "json", text: '{\n  "ok": true\n}' },
      { type: "prose", text: " fim." },
    ]);
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
