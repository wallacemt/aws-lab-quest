import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
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

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || lower.endsWith(".md")) {
    return true;
  }

  return file.type === "application/pdf" || file.type === "text/markdown" || file.type === "text/plain";
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const formData = await request.formData();
  const certificationCode = String(formData.get("certificationCode") ?? "").trim();
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

  const certification = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode },
    select: { id: true, code: true },
  });

  if (!certification) {
    return NextResponse.json({ error: "Certificacao invalida." }, { status: 400 });
  }

  const job = await createIngestionJob({
    uploadType: "SIMULADO_GENERATION",
    createdByUserId: adminCheck.userId,
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
        uploadType: "SIMULADO_PDF",
        buffer,
        mimeType: file.type || "application/octet-stream",
      });

      const uploaded = await createUploadedFileRecord({
        uploadType: "SIMULADO_PDF",
        certificationPresetId: certification.id,
        uploadedByUserId: adminCheck.userId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        storageBucket: storage.bucket,
        storagePath: storage.path,
        sha256: buildSha256(buffer),
        metadata: {
          pipeline: "question-ingestion-v2",
        },
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

    return NextResponse.json({
      jobId: job.id,
      ...result,
    });
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

    devAuditLog("admin.pdf.ingest.failed", {
      adminUserId: adminCheck.userId,
      certificationCode,
      jobId: job.id,
      error: message,
    });

    return NextResponse.json({ error: message }, { status: cancelledByAdmin ? 409 : 422 });
  }
}
