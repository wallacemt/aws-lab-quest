import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createIngestionJob, updateIngestionJob } from "@/lib/admin-ingestion";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";
import { ingestQuestionsFromPdf } from "@/lib/study-question-generation";

type IngestPayload = {
  certificationCode?: string;
  extractedText?: string;
  desiredCount?: number;
  ingestMode?: "generate-new" | "extract-existing";
  jobId?: string;
  uploadedFileId?: string;
};

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  let body: IngestPayload;
  try {
    body = (await request.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const certificationCode = body.certificationCode?.trim();
  const extractedText = body.extractedText?.trim();

  if (!certificationCode) {
    return NextResponse.json({ error: "Certificacao obrigatoria." }, { status: 400 });
  }

  if (!extractedText || extractedText.length < 80) {
    return NextResponse.json({ error: "Texto extraido insuficiente para ingestao." }, { status: 400 });
  }

  const desiredCount =
    typeof body.desiredCount === "number" && Number.isFinite(body.desiredCount)
      ? Math.max(5, Math.min(50, Math.round(body.desiredCount)))
      : 20;
  const ingestMode = body.ingestMode === "extract-existing" ? "extract-existing" : "generate-new";

  devAuditLog("admin.pdf.ingest.request", {
    adminUserId: adminCheck.userId,
    certificationCode,
    ingestMode,
    desiredCount,
    extractedLength: extractedText.length,
    hasUploadedFileId: Boolean(body.uploadedFileId),
  });

  let jobId = body.jobId?.trim() || null;

  try {
    if (!jobId) {
      const certification = await prisma.certificationPreset.findUnique({
        where: { code: certificationCode },
        select: { id: true },
      });

      const job = await createIngestionJob({
        uploadType: "SIMULADO_GENERATION",
        createdByUserId: adminCheck.userId,
        certificationPresetId: certification?.id,
        desiredCount,
        fileName: "simulado-ingest",
        status: ingestMode === "extract-existing" ? "EXTRACTING" : "GENERATING",
        progressPercent: 55,
        message:
          ingestMode === "extract-existing"
            ? "Iniciando extracao de questoes existentes do PDF."
            : "Iniciando geracao de questoes.",
      });

      jobId = job.id;
    } else {
      await updateIngestionJob(jobId, {
        status: ingestMode === "extract-existing" ? "EXTRACTING" : "GENERATING",
        progressPercent: 55,
        message:
          ingestMode === "extract-existing"
            ? "Iniciando extracao de questoes existentes do PDF."
            : "Iniciando geracao de questoes.",
        uploadedFileId: body.uploadedFileId?.trim() || undefined,
      });
    }

    const result = await ingestQuestionsFromPdf({
      certificationCode,
      extractedText,
      desiredCount,
      mode: ingestMode,
      sourceUploadedFileId: body.uploadedFileId?.trim() || undefined,
      onProgress: async (progress) => {
        if (!jobId) {
          return;
        }

        await updateIngestionJob(jobId, {
          status: progress.status,
          progressPercent: progress.progressPercent,
          message: progress.message,
          generatedCount: progress.generatedCount,
          savedCount: progress.savedCount,
          uploadedFileId: body.uploadedFileId?.trim() || undefined,
          finished: progress.status === "COMPLETED",
        });
      },
    });

    return NextResponse.json({
      jobId,
      ...result,
    });
  } catch (error) {
    if (jobId) {
      await updateIngestionJob(jobId, {
        status: "FAILED",
        progressPercent: 100,
        message: "Falha na ingestao de questoes.",
        errorMessage: error instanceof Error ? error.message : "Falha ao gerar e salvar questoes.",
        finished: true,
      }).catch(() => undefined);
    }

    const message = error instanceof Error ? error.message : "Falha ao gerar e salvar questoes.";
    devAuditLog("admin.pdf.ingest.failed", {
      adminUserId: adminCheck.userId,
      certificationCode,
      ingestMode,
      jobId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
