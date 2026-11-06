import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPdfFromUrl } from "@/lib/pdf-url-fetch";

afterEach(() => vi.unstubAllGlobals());

describe("fetchPdfFromUrl", () => {
  it("recusa redirect sem seguir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://other.example/a.pdf" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPdfFromUrl("https://files.example/a.pdf")).rejects.toThrow("redirecionou");
    expect(fetchMock).toHaveBeenCalledWith("https://files.example/a.pdf", expect.objectContaining({ redirect: "manual" }));
  });

  it("cancela a leitura assim que excede 20 MB", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(20 * 1024 * 1024));
        controller.enqueue(new Uint8Array(1));
      },
      cancel() { cancelled = true; },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    await expect(fetchPdfFromUrl("https://files.example/a.pdf")).rejects.toThrow("20 MB");
    expect(cancelled).toBe(true);
  });

  it("recusa conteúdo sem magic bytes PDF", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not a pdf")));
    await expect(fetchPdfFromUrl("https://files.example/a.pdf")).rejects.toThrow("não é um PDF válido");
  });

  it("retorna um PDF válido com nome derivado e extensão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("%PDF-1.7\nbody")));
    const result = await fetchPdfFromUrl("https://files.example/docs/prova-final");
    expect(result.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.fileName).toBe("prova-final.pdf");
  });
});
