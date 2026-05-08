declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    text?: string;
  };

  const parsePdf: (dataBuffer: Buffer) => Promise<PdfParseResult>;
  export default parsePdf;
}
