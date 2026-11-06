import { isAllowedFeedUrl } from "@/lib/url-validation";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export async function assertPdfUrlAllowed(url: string, allowlist: string[]): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("A URL informada é inválida.");
  }
  if (parsed.protocol !== "https:") throw new Error("A URL do PDF deve usar HTTPS.");
  if (!isAllowedFeedUrl(url)) throw new Error("A URL do PDF aponta para um endereço não permitido.");
  const hostname = parsed.hostname.toLowerCase();
  const allowed = allowlist.map((host) => host.toLowerCase()).some((host) => hostname === host || hostname.endsWith(`.${host}`));
  if (allowlist.length === 0 || !allowed) throw new Error("Host fora da allowlist de ingestão por URL.");
}

export async function fetchPdfFromUrl(url: string): Promise<{ buffer: Buffer; fileName: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { redirect: "manual", signal: controller.signal });
    if (response.status >= 300 && response.status < 400) throw new Error("O servidor redirecionou a URL do PDF; redirecionamentos não são permitidos.");
    if (!response.ok) throw new Error(`Falha ao baixar o PDF (HTTP ${response.status}).`);
    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > MAX_PDF_BYTES) {
      await response.body?.cancel();
      throw new Error("O PDF excede o limite de 20 MB.");
    }
    if (!response.body) throw new Error("A resposta não contém o arquivo PDF.");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PDF_BYTES) {
        await reader.cancel();
        throw new Error("O PDF excede o limite de 20 MB.");
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("O conteúdo não é um PDF válido.");
    }

    let segment = parsedPathSegment(url);
    try { segment = decodeURIComponent(segment); } catch { /* mantém o segmento literal */ }
    let fileName = segment.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!fileName || fileName === "." || fileName === "..") fileName = "documento";
    if (!fileName.toLowerCase().endsWith(".pdf")) fileName += ".pdf";
    return { buffer, fileName };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("O download do PDF excedeu o tempo limite de 30 segundos.");
    if (error instanceof Error) throw error;
    throw new Error("Falha ao baixar o PDF.");
  } finally {
    clearTimeout(timeout);
  }
}

function parsedPathSegment(rawUrl: string): string {
  const pathname = new URL(rawUrl).pathname;
  return pathname.split("/").filter(Boolean).at(-1) ?? "documento";
}
