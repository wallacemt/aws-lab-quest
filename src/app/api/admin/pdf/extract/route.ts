import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildSha256,
  createIngestionJob,
  createUploadedFileRecord,
  deleteAdminUploadedFileById,
  ensureIngestionJobNotCancelled,
  updateIngestionJob,
  uploadAdminFileToSupabase,
} from "@/lib/admin-ingestion";
import { normalizeText, extractTextFromFile } from "@/lib/question-ingestion-pipeline";
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
  const file = formData.get("file");
  const certificationCode = formData.get("certificationCode");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatorio." }, { status: 400 });
  }

  if (typeof certificationCode !== "string" || !certificationCode.trim()) {
    return NextResponse.json({ error: "Certificacao obrigatoria." }, { status: 400 });
  }

  const certification = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode.trim() },
    select: { id: true, code: true, name: true },
  });

  if (!certification) {
    return NextResponse.json({ error: "Certificacao invalida." }, { status: 400 });
  }

  if (!isSupportedFile(file)) {
    return NextResponse.json({ error: "Formato invalido. Envie PDF ou Markdown." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo excede o limite de 20MB." }, { status: 413 });
  }

  devAuditLog("admin.file.extract.request", {
    adminUserId: adminCheck.userId,
    certificationCode: certification.code,
    fileName: file.name,
    fileSize: file.size,
  });

  let jobId: string | null = null;
  let uploadedFileId: string | null = null;

  try {
    const ingestJob = await createIngestionJob({
      uploadType: "SIMULADO_PDF",
      createdByUserId: adminCheck.userId,
      certificationPresetId: certification.id,
      status: "UPLOADING",
      progressPercent: 10,
      message: "Enviando arquivo para storage...",
      fileName: file.name,
    });
    jobId = ingestJob.id;

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = await uploadAdminFileToSupabase({
      fileName: file.name,
      certificationCode: certification.code,
      uploadType: "SIMULADO_PDF",
      buffer,
      mimeType: file.type || "application/octet-stream",
    });

    const uploadedFile = await createUploadedFileRecord({
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
        stage: "extract",
        parser: "pdf-parse|markdown",
      },
    });
    uploadedFileId = uploadedFile.id;

    await updateIngestionJob(ingestJob.id, {
      status: "EXTRACTING",
      progressPercent: 50,
      message: "Extraindo texto estruturado...",
      uploadedFileId,
    });

    await ensureIngestionJobNotCancelled(ingestJob.id);

    const extractedText = normalizeText(await extractTextFromFile(file));

    await ensureIngestionJobNotCancelled(ingestJob.id);

    await updateIngestionJob(ingestJob.id, {
      status: "COMPLETED",
      progressPercent: 100,
      message: "Texto extraido com sucesso.",
      finished: true,
    });

    return NextResponse.json({
      jobId: ingestJob.id,
      uploadedFileId,
      fileName: file.name,
      characters: extractedText.length,
      preview: extractedText.slice(0, 4000),
      extractedText,
      certification,
    });
  } catch (e) {
    if (uploadedFileId && !(e instanceof Error && e.message.includes("cancelado manualmente"))) {
      await deleteAdminUploadedFileById(uploadedFileId).catch(() => undefined);
    }

    if (jobId) {
      await updateIngestionJob(jobId, {
        status: "FAILED",
        progressPercent: 100,
        message: "Falha na extracao.",
        errorMessage: e instanceof Error ? e.message : "Falha ao processar arquivo.",
        finished: true,
      }).catch(() => undefined);
    }

    return NextResponse.json({ error: "Falha ao processar arquivo." }, { status: 422 });
  }
}
