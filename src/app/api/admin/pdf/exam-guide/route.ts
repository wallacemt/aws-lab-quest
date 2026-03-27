import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { extractPdfText } from "@/features/admin/services/pdf-extraction";
import { buildSha256, createUploadedFileRecord, uploadAdminFileToSupabase } from "@/lib/admin-ingestion";
import { devAuditLog } from "@/lib/dev-audit";
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
  const manualTextRaw = formData.get("manualText");
  const manualText = typeof manualTextRaw === "string" ? manualTextRaw.trim() : "";
  const overwriteConfirmed = formData.get("overwriteConfirmed") === "true";

  if (typeof certificationCode !== "string" || !certificationCode.trim()) {
    return NextResponse.json({ error: "Certificacao obrigatoria." }, { status: 400 });
  }

  const hasPdfFile = file instanceof File && file.size > 0;
  const hasManualText = manualText.length > 0;

  if (!hasPdfFile && !hasManualText) {
    return NextResponse.json(
      { error: "Envie um PDF do Exam Guide ou preencha o texto manual do guia." },
      { status: 400 },
    );
  }

  const certification = await prisma.certificationPreset.findUnique({
    where: { code: certificationCode.trim() },
    select: { id: true, code: true, name: true, examGuide: true, updatedAt: true },
  });

  if (!certification) {
    return NextResponse.json({ error: "Certificacao invalida." }, { status: 400 });
  }

  if (certification.examGuide && certification.examGuide.trim().length > 0 && !overwriteConfirmed) {
    return NextResponse.json(
      {
        error: "Ja existe Exam Guide para esta certificacao. Confirme a sobrescrita para continuar.",
        conflict: {
          certificationCode: certification.code,
          certificationName: certification.name,
          updatedAt: certification.updatedAt,
        },
      },
      { status: 409 },
    );
  }

  devAuditLog("admin.exam-guide.request", {
    adminUserId: adminCheck.userId,
    certificationCode: certification.code,
    hasPdfFile,
    hasManualText,
    overwriteConfirmed,
  });

  try {
    let extractedText = manualText;
    let fileName = "manual-input";
    let uploadedFileId: string | null = null;

    if (hasPdfFile) {
      if (!isPdfFile(file)) {
        return NextResponse.json({ error: "Formato invalido. Envie um arquivo PDF." }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "PDF excede o limite de 20MB." }, { status: 413 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      extractedText = await extractPdfText(buffer);
      fileName = file.name;

      const storage = await uploadAdminFileToSupabase({
        fileName: file.name,
        certificationCode: certification.code,
        uploadType: "EXAM_GUIDE",
        buffer,
        mimeType: file.type || "application/pdf",
      });

      const uploadedFile = await createUploadedFileRecord({
        uploadType: "EXAM_GUIDE",
        certificationPresetId: certification.id,
        uploadedByUserId: adminCheck.userId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        fileSizeBytes: file.size,
        storageBucket: storage.bucket,
        storagePath: storage.path,
        sha256: buildSha256(buffer),
        metadata: {
          source: "exam-guide-upload",
        },
      });
      uploadedFileId = uploadedFile.id;
    }

    if (extractedText.trim().length < 200) {
      return NextResponse.json(
        {
          error:
            "Texto insuficiente no Exam Guide. Envie um guia valido com topicos e percentuais ou complemente no campo manual.",
        },
        { status: 422 },
      );
    }

    await prisma.certificationPreset.update({
      where: { id: certification.id },
      data: {
        examGuide: extractedText,
      },
    });

    devAuditLog("admin.exam-guide.saved", {
      adminUserId: adminCheck.userId,
      certificationCode: certification.code,
      fileName,
      uploadedFileId,
      characters: extractedText.length,
    });

    return NextResponse.json({
      uploadedFileId,
      fileName,
      characters: extractedText.length,
      preview: extractedText.slice(0, 4000),
      certification: {
        code: certification.code,
        name: certification.name,
      },
      message: "Exam Guide salvo com sucesso.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar e salvar o Exam Guide.";
    devAuditLog("admin.exam-guide.failed", {
      adminUserId: adminCheck.userId,
      certificationCode: certification.code,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
