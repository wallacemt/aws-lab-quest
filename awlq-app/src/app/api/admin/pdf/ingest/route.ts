import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/features/audit/server/with-admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { ingestAdminPdf } from "@/lib/admin-ingestion-pdf";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || lower.endsWith(".md")) {
    return true;
  }

  return file.type === "application/pdf" || file.type === "text/markdown" || file.type === "text/plain";
}

export const POST = withAdminAudit("pdf/ingest", async (request: NextRequest) => {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const formData = await request.formData();
  const certificationCode = String(formData.get("certificationCode") ?? "").trim();
  const rawUploadType = String(formData.get("uploadType") ?? "simulado_generation");
  // EXAM_GUIDE intentionally excluded: exam-guide PDFs don't contain question
  // blocks and are handled by the dedicated /api/admin/pdf/exam-guide route instead.
  const uploadTypeMap: Record<string, "SIMULADO_PDF" | "SIMULADO_GENERATION"> = {
    simulate_pdf: "SIMULADO_PDF",
    simulado_generation: "SIMULADO_GENERATION",
  };
  const resolvedUploadType = uploadTypeMap[rawUploadType] ?? "SIMULADO_GENERATION";
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);

  if (!certificationCode) {
    return NextResponse.json({ error: "Certificacao obrigatoria." }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Envie ao menos um arquivo PDF ou MD." }, { status: 400 });
  }

  for (const file of files) {
    if (!isSupportedFile(file)) {
      return NextResponse.json({ error: `Arquivo nao suportado: ${file.name}.` }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `Arquivo excede 20MB: ${file.name}.` }, { status: 413 });
    }
  }

  const result = await ingestAdminPdf({
    files,
    certificationCode,
    uploadType: resolvedUploadType,
    adminUserId: adminCheck.userId,
  });
  return result;
});
