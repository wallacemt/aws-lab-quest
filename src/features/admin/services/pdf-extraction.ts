import { PDFParse } from "pdf-parse";

const MAX_TEXT_LENGTH = 120_000;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  //exemple
  //     async function run() {
  // 	const parser = new PDFParse({ url: 'https://bitcoin.org/bitcoin.pdf' });

  // 	const result = await parser.getText();
  // 	console.log(result.text);
  // }
//   const pdfParse = new PDFParse({ b });
//   const result = await pdfParse(buffer);
//   const normalized = result.text
//     .replace(/\s+\n/g, "\n")
//     .replace(/\n{3,}/g, "\n\n")
//     .trim();

//   if (!normalized) {
//     throw new Error("Nao foi possivel extrair texto do PDF.");
//   }

//   return normalized.slice(0, MAX_TEXT_LENGTH);
return 'teste'
}
