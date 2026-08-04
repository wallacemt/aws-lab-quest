import { createHash } from "node:crypto";
import { normalizeText } from "../shared/ingestion-pipeline.js";

type PdfParseResult = { text?: string };

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
  const parser = (pdfModule.default ?? pdfModule) as (b: Buffer) => Promise<PdfParseResult>;
  const parsed = await parser(buffer);
  return parsed.text ?? "";
}

export type FetchResult =
  | { ok: true; text: string; sha256: string; unchanged: boolean }
  | { ok: false; error: string };

export async function fetchAndExtractText(
  url: string,
  previousSha256?: string | null
): Promise<FetchResult> {
  let response: Response;
  try {
    // LSF-2026-201: don't auto-follow redirects — a redirect to an internal/IMDS
    // address would bypass the SSRF allowlist check done at URL registration time.
    response = await fetch(url, {
      headers: { "User-Agent": "aws-quest-worker/1.0" },
      signal: AbortSignal.timeout(90_000),
      redirect: "manual",
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status >= 300 && response.status < 400) {
    return { ok: false, error: `Redirects are not followed (HTTP ${response.status})` };
  }

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  if (previousSha256 && sha256 === previousSha256) {
    return { ok: true, text: "", sha256, unchanged: true };
  }

  const contentType = response.headers.get("content-type") ?? "";
  let rawText: string;

  if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    try {
      rawText = await parsePdfBuffer(buffer);
    } catch (err) {
      return { ok: false, error: `PDF parse error: ${err instanceof Error ? err.message : String(err)}` };
    }
  } else {
    rawText = buffer.toString("utf-8");
  }

  return { ok: true, text: normalizeText(rawText), sha256, unchanged: false };
}
