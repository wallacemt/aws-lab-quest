import { PDFParse } from "pdf-parse";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const MAX_TEXT_LENGTH = 120_000;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "alq-pdf-"));
  const tempFilePath = join(tempDir, `${Date.now()}-${crypto.randomUUID()}.pdf`);
  const tempFileUrl = pathToFileURL(tempFilePath);

  let parser: PDFParse | null = null;

  try {
    await writeFile(tempFilePath, buffer);

    parser = new PDFParse({ url: tempFileUrl });
    const result = await parser.getText();

    const normalized = result.text
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!normalized) {
      throw new Error("Nao foi possivel extrair texto do PDF.");
    }

    return normalized.slice(0, MAX_TEXT_LENGTH);
  } finally {
    if (parser) {
      await parser.destroy().catch(() => undefined);
    }

    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
