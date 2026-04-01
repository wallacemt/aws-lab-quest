const MAX_TEXT_LENGTH = 120_000;

type PdfParseResult = {
  text?: string;
};

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
  const parser = (pdfModule.default ?? pdfModule) as (dataBuffer: Buffer) => Promise<PdfParseResult>;
  const parsed = await parser(buffer);
  return parsed.text ?? "";
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function normalizeMarkdown(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function fallbackExamGuideMarkdown(rawText: string): string {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    return "";
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((line) => /\d+\s*%|domain|dominio|objective|objetivo|task statement/i.test(line))
    .slice(0, 12)
    .map((line) => `- ${line}`);

  return normalizeMarkdown(
    [
      "# Exam Guide",
      "",
      bullets.length > 0 ? "## Dominios e foco" : "## Conteudo extraido",
      ...(bullets.length > 0 ? bullets : lines.slice(0, 20).map((line) => `- ${line}`)),
      "",
      "## Texto completo",
      normalized,
    ].join("\n"),
  );
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const text = normalizeText(await parsePdfBuffer(buffer));

  if (!text) {
    throw new Error(
      "Nao foi possivel extrair texto do PDF. Verifique se o arquivo contem texto selecionavel ou envie markdown.",
    );
  }

  return text;
}

export async function toExamGuideMarkdown(rawText: string): Promise<string> {
  const markdown = fallbackExamGuideMarkdown(rawText);
  if (!markdown || markdown.length < 120) {
    throw new Error("Texto insuficiente para gerar markdown do Exam Guide.");
  }

  return markdown;
}
