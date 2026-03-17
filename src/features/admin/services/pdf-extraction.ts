import PdfParse from "pdf-parse";
import pdf from "pdf-parse";
import PDFParser from "pdf2json";
const MAX_TEXT_LENGTH = 120_000;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const start = Date.now();

  //   try {
  //     console.log("[Extract PDF] Iniciando extração");
  //     console.log(`[Extract PDF] Buffer size: ${buffer.length}`);

  //     const data = await pdf(buffer);

  //     console.log(`[Extract PDF] Páginas: ${data.numpages}`);

  //     const text = data.text || "";

  //     if (!text.trim()) {
  //       console.warn("[Extract PDF] Texto vazio - possível PDF escaneado");
  //       throw new Error("Nao foi possivel extrair texto do PDF.");
  //     }

  //     const normalized = text
  //       .replace(/\s+\n/g, "\n")
  //       .replace(/\n{3,}/g, "\n\n")
  //       .trim();

  //     const finalText = normalized.slice(0, MAX_TEXT_LENGTH);

  //     console.log(`[Extract PDF] Caracteres: ${finalText.length}`);
  //     console.log(`[Extract PDF] Tempo: ${Date.now() - start}ms`);

  //     return finalText;

  //   } catch (err: any) {
  //     console.error("[Extract PDF] Erro real:", err);
  //     throw err;
  //   }
  const pdfParser = new PDFParser();
  return new Promise((resolve, reject) => {
    console.log("[Extract PDF] Iniciando extração");

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error("PDF parsing error:", errData.parserError);
      reject(new Error("Failed to parse PDF"));
    });

    pdfParser.on("pdfParser_dataReady", () => {
      const parsedText = pdfParser.getRawTextContent();
      resolve(parsedText);
    });

    console.log(`[Extract PDF] Buffer size: ${buffer.length}`);
    pdfParser.parseBuffer(buffer);
  })
    .then((text) => {
      if (!(text as string).trim()) {
        console.warn("[Extract PDF] Texto vazio - possível PDF escaneado");
        throw new Error("Nao foi possivel extrair texto do PDF.");
      }
      const normalized = (text as string)
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      const finalText = normalized.slice(0, MAX_TEXT_LENGTH);

      console.log(`[Extract PDF] Caracteres: ${finalText.length}`);
      console.log(`[Extract PDF] Tempo: ${Date.now() - start}ms`);

      return finalText;
    })
    .catch((err) => {
      console.error("[Extract PDF] Erro real:", err);
      throw err;
    });
}
