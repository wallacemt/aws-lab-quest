import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { extractPdfText } from "@/features/admin/services/pdf-extraction";
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
    select: { code: true, name: true },
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

  try {
    console.log("[Extract PDF]: Iniciando extracão");
    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractPdfText(buffer);

    return NextResponse.json({
      fileName: file.name,
      characters: extractedText.length,
      preview: extractedText.slice(0, 4000),
      extractedText,
      certification,
    });
  } catch (e) {
    console.log(`[Extract PDF]: Erro ao processar documento: ${e}`);
    return NextResponse.json({ error: "Falha ao processar PDF." }, { status: 422 });
  }
}
