import { getOcrAiModel } from "@/lib/ai";
import { OCR_PROMPT } from "@/utils/prompt.utils";

import PDFParser from "pdf2json";
const MAX_TEXT_LENGTH = 120_000;
const MAX_MARKDOWN_SOURCE_CHARS = 100_000;

function normalizeText(input: string): string {
  return input
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
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

function decodePdf2JsonPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("Pages" in payload)) {
    return "";
  }

  const pages = (payload as { Pages?: Array<{ Texts?: Array<{ R?: Array<{ T?: string }> }> }> }).Pages ?? [];
  const parts: string[] = [];

  for (const page of pages) {
    const texts = page.Texts ?? [];
    for (const textNode of texts) {
      const runs = textNode.R ?? [];
      for (const run of runs) {
        if (typeof run.T !== "string") {
          continue;
        }
        try {
          parts.push(decodeURIComponent(run.T));
        } catch {
          parts.push(run.T);
        }
      }
    }
    parts.push("\n");
  }

  return parts.join(" ");
}

async function extractWithPdf2Json(buffer: Buffer): Promise<string> {
  const pdfParser = new PDFParser();

  return new Promise((resolve, reject) => {
    pdfParser.on("pdfParser_dataError", (errData: unknown) => {
      const parserError =
        typeof errData === "object" && errData !== null && "parserError" in errData
          ? (errData as { parserError?: unknown }).parserError
          : undefined;
      reject(new Error(`pdf2json failure: ${String(parserError ?? "unknown")}`));
    });

    pdfParser.on("pdfParser_dataReady", (data: unknown) => {
      const raw = pdfParser.getRawTextContent();
      if (typeof raw === "string" && raw.trim().length > 0) {
        resolve(raw);
        return;
      }

      resolve(decodePdf2JsonPayload(data));
    });

    pdfParser.parseBuffer(buffer);
  });
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const start = Date.now();

  console.log("[Extract PDF] Iniciando extração");
  console.log(`[Extract PDF] Buffer size: ${buffer.length}`);

  let parseText = "";
  let parserErrorMessage = "";

  try {
    const fallback = await extractWithPdf2Json(buffer);
    parseText = normalizeText(fallback);
    console.log(`[Extract PDF] pdf2json chars: ${parseText.length}`);
  } catch (error) {
    parserErrorMessage = error instanceof Error ? error.message : "pdf2json unknown error";
    console.warn(`[Extract PDF] pdf2json falhou: ${parserErrorMessage}`);
  }

  if (!parseText.trim()) {
    console.warn("[Extract PDF] Texto vazio - possivel PDF escaneado");
    const detail = parserErrorMessage ? ` (${parserErrorMessage})` : "";
    throw new Error(
      `Nao foi possivel extrair texto do PDF${detail}. O arquivo parece escaneado/imagem. Use OCR ou cole o texto manualmente no campo de fallback.`,
    );
  }

  console.log(`[Extract PDF] Caracteres finais: ${parseText.length}`);
  console.log(`[Extract PDF] Tempo: ${Date.now() - start}ms`);
  return parseText;
}

export async function extractPdfTextWithGeminiOcr(buffer: Buffer, mimeType = "application/pdf"): Promise<string> {
  const model = getOcrAiModel();
  const result = await model.generateContent([
    { text: OCR_PROMPT },
    {
      inlineData: {
        mimeType,
        data: buffer.toString("base64"),
      },
    },
  ]);

  const responseText = result.response.text().trim();
  if (!responseText) {
    throw new Error("OCR nao retornou conteudo textual.");
  }

  let maybeError: { error?: string } | null = null;
  try {
    maybeError = JSON.parse(responseText) as { error?: string };
  } catch {
    maybeError = null;
  }

  if (maybeError?.error) {
    throw new Error(maybeError.error);
  }

  return normalizeText(responseText);
}

export async function buildExamGuideMarkdownWithAi(rawText: string): Promise<string> {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    throw new Error("Texto vazio para estruturar em markdown.");
  }

  const model = getOcrAiModel();
  const prompt = [
    "Voce recebera texto OCR de um AWS Certification Exam Guide.",
    "Converta para markdown limpo, legivel e objetivo.",
    "",
    "Regras obrigatorias:",
    "- Nao invente conteudo.",
    "- Preserve numeros, percentuais e codigos exatamente.",
    "- Organize com titulos (##), listas e tabelas quando fizer sentido.",
    "- Crie uma secao inicial '## Resumo rapido' com 5 a 8 bullets.",
    "- Se houver dominios com peso, crie '## Dominios e pesos'.",
    "- Mantenha uma secao final '## Texto de referencia' com o texto consolidado e limpo.",
    "- Retorne apenas markdown puro, sem bloco de codigo.",
    "",
    "Texto fonte:",
    normalized.slice(0, MAX_MARKDOWN_SOURCE_CHARS),
  ].join("\n");

  const result = await model.generateContent(prompt);
  const markdown = normalizeMarkdown(result.response.text());

  if (!markdown || markdown.length < 120) {
    throw new Error("IA retornou markdown insuficiente para o Exam Guide.");
  }

  return markdown;
}

export async function toExamGuideMarkdown(rawText: string): Promise<string> {
  try {
    return await buildExamGuideMarkdownWithAi(rawText);
  } catch {
    return fallbackExamGuideMarkdown(rawText);
  }
}
