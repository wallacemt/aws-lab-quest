import {
  buildSha256,
  createIngestionJob,
  createUploadedFileRecord,
  ensureIngestionJobNotCancelled,
  updateIngestionJob,
  uploadAdminFileToSupabase,
} from "@/lib/admin-ingestion";
import { ingestQuestions } from "@/lib/question-ingestion-pipeline";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";

export async function ingestAdminPdf(params: {
  files: File[];
  certificationCode: string;
  uploadType: "SIMULADO_PDF" | "SIMULADO_GENERATION";
  adminUserId: string;
}): Promise<Response> {
  const { files, certificationCode, uploadType, adminUserId } = params;
  const certification = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode },
    select: { id: true, code: true },
  });

  if (!certification) {
    return Response.json({ error: "Certificacao invalida." }, { status: 400 });
  }

  const job = await createIngestionJob({
    uploadType,
    createdByUserId: adminUserId,
    certificationPresetId: certification.id,
    status: "UPLOADING",
    progressPercent: 10,
    fileName: files.length === 1 ? files[0].name : `${files.length}-files`,
    message: "Preparando upload dos arquivos para ingestao.",
  });

  const uploadedFileIdsByName: Record<string, string> = {};

  try {
    for (const file of files) {
      await ensureIngestionJobNotCancelled(job.id);
      const buffer = Buffer.from(await file.arrayBuffer());
      const storage = await uploadAdminFileToSupabase({
        fileName: file.name,
        certificationCode,
        uploadType,
        buffer,
        mimeType: file.type || "application/octet-stream",
      });
      const uploaded = await createUploadedFileRecord({
        uploadType,
        certificationPresetId: certification.id,
        uploadedByUserId: adminUserId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        storageBucket: storage.bucket,
        storagePath: storage.path,
        sha256: buildSha256(buffer),
        metadata: { pipeline: "question-ingestion-v2" },
      });
      uploadedFileIdsByName[file.name] = uploaded.id;
    }

    await updateIngestionJob(job.id, {
      status: "EXTRACTING",
      progressPercent: 25,
      message: "Iniciando pipeline deterministico de ingestao.",
    });
    const result = await ingestQuestions(files, {
      certificationCode,
      sourceUploadedFileIdsByName: uploadedFileIdsByName,
      onProgress: async (progress) => {
        await ensureIngestionJobNotCancelled(job.id);
        await updateIngestionJob(job.id, {
          status: progress.status,
          progressPercent: progress.progressPercent,
          message: progress.message,
          generatedCount: progress.generatedCount,
          savedCount: progress.savedCount,
          finished: progress.status === "COMPLETED",
        });
      },
    });
    await updateIngestionJob(job.id, {
      status: "COMPLETED",
      progressPercent: 100,
      message: "Ingestao concluida.",
      generatedCount: result.generatedCount,
      savedCount: result.savedCount,
      finished: true,
    });
    return Response.json({ jobId: job.id, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na ingestao de questoes.";
    const cancelledByAdmin = message.includes("cancelado manualmente");
    await updateIngestionJob(job.id, {
      status: "FAILED",
      progressPercent: 100,
      message: cancelledByAdmin ? "Ingestao cancelada manualmente." : "Falha na ingestao de questoes.",
      errorMessage: cancelledByAdmin ? "CANCELLED_BY_ADMIN" : message,
      finished: true,
    }).catch(() => undefined);
    devAuditLog("admin.pdf.ingest.failed", { adminUserId, certificationCode, jobId: job.id, error: message });
    return Response.json({ error: message }, { status: cancelledByAdmin ? 409 : 422 });
  }
}
