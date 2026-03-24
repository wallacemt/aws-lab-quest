import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { extractPdfText } from "@/features/admin/services/pdf-extraction";
import {
  buildSha256,
  createIngestionJob,
  createUploadedFileRecord,
  updateIngestionJob,
  uploadAdminFileToSupabase,
} from "@/lib/admin-ingestion";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") {
    return true;
  }

  return file.name.toLowerCase().endsWith(".pdf");
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
    return NextResponse.json({ error: "Arquivo PDF obrigatorio." }, { status: 400 });
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

  if (!isPdfFile(file)) {
    return NextResponse.json({ error: "Formato invalido. Envie um arquivo PDF." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "PDF excede o limite de 20MB." }, { status: 413 });
  }

  let jobId: string | null = null;

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
      mimeType: file.type || "application/pdf",
    });

    const uploadedFile = await createUploadedFileRecord({
      uploadType: "SIMULADO_PDF",
      certificationPresetId: certification.id,
      uploadedByUserId: adminCheck.userId,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      fileSizeBytes: file.size,
      storageBucket: storage.bucket,
      storagePath: storage.path,
      sha256: buildSha256(buffer),
      metadata: {
        stage: "extract",
      },
    });

    await updateIngestionJob(ingestJob.id, {
      status: "EXTRACTING",
      progressPercent: 35,
      message: "Extraindo texto do PDF...",
      uploadedFileId: uploadedFile.id,
    });

    const extractedText = await extractPdfText(buffer);

    await updateIngestionJob(ingestJob.id, {
      status: "COMPLETED",
      progressPercent: 100,
      message: "Texto extraido com sucesso.",
      finished: true,
    });

    return NextResponse.json({
      jobId: ingestJob.id,
      uploadedFileId: uploadedFile.id,
      fileName: file.name,
      characters: extractedText.length,
      preview: extractedText.slice(0, 4000),
      extractedText,
      certification,
    });
  } catch (e) {
    if (jobId) {
      await updateIngestionJob(jobId, {
        status: "FAILED",
        progressPercent: 100,
        message: "Falha na extracao.",
        errorMessage: e instanceof Error ? e.message : "Falha ao processar PDF.",
        finished: true,
      }).catch(() => undefined);
    }

    console.log(`[Extract PDF]: Erro ao processar documento: ${e}`);
    return NextResponse.json({ error: "Falha ao processar PDF." }, { status: 422 });
  }
}
