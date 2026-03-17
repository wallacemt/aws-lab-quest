import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { ingestQuestionsFromPdf } from "@/lib/study-question-generation";

type IngestPayload = {
  certificationCode?: string;
  extractedText?: string;
  desiredCount?: number;
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

  try {
    const result = await ingestQuestionsFromPdf({
      certificationCode,
      extractedText,
      desiredCount,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar e salvar questoes.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
