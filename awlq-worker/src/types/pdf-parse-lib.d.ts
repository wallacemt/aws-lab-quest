declare module "pdf-parse/lib/pdf-parse.js" {
  import type { Options, Result } from "pdf-parse";
  function pdfParse(dataBuffer: Buffer | Uint8Array, options?: Options): Promise<Result>;
  export = pdfParse;
}
