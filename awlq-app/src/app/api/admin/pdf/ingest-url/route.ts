import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/features/audit/server/with-admin-audit";
import { getPdfUrlAllowlist } from "@/features/mcp/server/settings-service";
import { requireAdmin } from "@/lib/admin-auth";
import { ingestAdminPdf } from "@/lib/admin-ingestion-pdf";
import { assertPdfUrlAllowed, fetchPdfFromUrl } from "@/lib/pdf-url-fetch";

const uploadTypeMap = {
  simulate_pdf: "SIMULADO_PDF",
  simulado_generation: "SIMULADO_GENERATION",
} as const;

export const POST = withAdminAudit("pdf/ingest-url", async (request: NextRequest) => {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const url = typeof input.url === "string" ? input.url : "";
  const certificationCode = typeof input.certificationCode === "string" ? input.certificationCode.trim() : "";
  if (!url) return NextResponse.json({ error: "URL obrigatória." }, { status: 400 });
  if (!certificationCode) return NextResponse.json({ error: "Certificacao obrigatoria." }, { status: 400 });
  const rawUploadType = typeof input.uploadType === "string" ? input.uploadType : "simulado_generation";
  if (rawUploadType !== "simulate_pdf" && rawUploadType !== "simulado_generation") {
    return NextResponse.json({ error: "Tipo de upload inválido." }, { status: 400 });
  }

  try {
    const allowlist = await getPdfUrlAllowlist();
    await assertPdfUrlAllowed(url, allowlist);
    const { buffer, fileName } = await fetchPdfFromUrl(url);
    const file = new File([new Uint8Array(buffer).slice()], fileName, { type: "application/pdf" });
    const result = await ingestAdminPdf({
      files: [file], certificationCode,
      uploadType: uploadTypeMap[rawUploadType], adminUserId: adminCheck.userId,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao obter o PDF informado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
