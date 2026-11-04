import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), getPdfUrlAllowlist: vi.fn(), assertPdfUrlAllowed: vi.fn(),
  fetchPdfFromUrl: vi.fn(), ingestAdminPdf: vi.fn(),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/mcp/server/settings-service", () => ({ getPdfUrlAllowlist: mocks.getPdfUrlAllowlist }));
vi.mock("@/lib/pdf-url-fetch", () => ({ assertPdfUrlAllowed: mocks.assertPdfUrlAllowed, fetchPdfFromUrl: mocks.fetchPdfFromUrl }));
vi.mock("@/lib/admin-ingestion-pdf", () => ({ ingestAdminPdf: mocks.ingestAdminPdf }));

import { POST } from "@/app/api/admin/pdf/ingest-url/route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/admin/pdf/ingest-url", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/admin/pdf/ingest-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mocks.getPdfUrlAllowlist.mockResolvedValue(["files.example"]);
    mocks.assertPdfUrlAllowed.mockResolvedValue(undefined);
    mocks.fetchPdfFromUrl.mockResolvedValue({ buffer: Buffer.from("%PDF-1.7"), fileName: "exam.pdf" });
    mocks.ingestAdminPdf.mockResolvedValue(Response.json({ jobId: "job-1", generatedCount: 2, savedCount: 2 }));
  });

  it("recusa allowlist vazia sem iniciar ingestão", async () => {
    mocks.getPdfUrlAllowlist.mockResolvedValue([]);
    mocks.assertPdfUrlAllowed.mockRejectedValue(new Error("Host fora da allowlist de ingestão por URL."));
    const response = await POST(request({ url: "https://files.example/exam.pdf", certificationCode: "AWS" }) as never);
    expect(response.status).toBe(400);
    expect(mocks.ingestAdminPdf).not.toHaveBeenCalled();
  });

  it("retorna 400 para host fora da allowlist", async () => {
    mocks.assertPdfUrlAllowed.mockRejectedValue(new Error("Host fora da allowlist de ingestão por URL."));
    const response = await POST(request({ url: "https://evil.example/exam.pdf", certificationCode: "AWS" }) as never);
    expect(response.status).toBe(400);
    expect(mocks.ingestAdminPdf).not.toHaveBeenCalled();
  });

  it("encaminha o arquivo e parâmetros corretos e repassa resposta", async () => {
    const response = await POST(request({ url: "https://files.example/exam.pdf", certificationCode: "AWS", uploadType: "simulate_pdf" }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ jobId: "job-1", generatedCount: 2, savedCount: 2 });
    expect(mocks.assertPdfUrlAllowed).toHaveBeenCalledWith("https://files.example/exam.pdf", ["files.example"]);
    expect(mocks.ingestAdminPdf).toHaveBeenCalledWith(expect.objectContaining({
      certificationCode: "AWS", uploadType: "SIMULADO_PDF", adminUserId: "admin-1",
      files: [expect.objectContaining({ name: "exam.pdf", type: "application/pdf" })],
    }));
  });
});
