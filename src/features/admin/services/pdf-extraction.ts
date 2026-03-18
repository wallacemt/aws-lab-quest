import PDFParser from "pdf2json";
const MAX_TEXT_LENGTH = 120_000;

function normalizeText(input: string): string {
  return input
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
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
