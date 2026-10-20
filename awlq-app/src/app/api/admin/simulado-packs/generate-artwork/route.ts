import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { callAI, AiNotConfiguredError } from "@/lib/ai";
import { fetchPollinationsImage, PIXEL_ART_STYLE_RULES } from "@/lib/pollinations";

type GenerateBody = {
  simuladoName?: string;
  customPrompt?: string;
  model?: string;
};

const DEFAULT_POLLINATIONS_MODEL = "flux";

async function generateImagePromptFromName(simuladoName: string): Promise<string> {
  const aiPrompt = [
    "Voce e um diretor de arte criando uma capa para um simulado de certificacao AWS.",
    `Nome do simulado (personagem tema): "${simuladoName}".`,
    "Gere UM unico prompt em ingles para um modelo de geracao de imagem (flux).",
    "Requisitos obrigatorios do prompt:",
    "- A cena deve retratar visualmente o personagem do nome do simulado.",
    "- A cena deve incluir elementos da Amazon Web Services (AWS) e seus servicos (ex.: data center, nuvem, cubos S3, instancias EC2, lambda, icones de cloud, racks) integrados a cena.",
    PIXEL_ART_STYLE_RULES,
    "Responda SOMENTE com o prompt final, sem aspas, sem prefixos, sem explicacao.",
  ].join("\n");

  const text = (await callAI(aiPrompt, "SIMULADO_MESSAGE")).trim();

  const cleaned = text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^prompt[:\-\s]+/i, "")
    .trim();

  if (!cleaned) {
    throw new Error("IA retornou um prompt vazio.");
  }

  return cleaned;
}

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => ({}))) as Partial<GenerateBody>;
  const simuladoName = body.simuladoName?.trim() ?? "";
  const customPrompt = body.customPrompt?.trim() ?? "";
  const model = body.model?.trim() || DEFAULT_POLLINATIONS_MODEL;

  if (!simuladoName && !customPrompt) {
    return NextResponse.json(
      { error: "Informe simuladoName ou customPrompt." },
      { status: 400 },
    );
  }

  try {
    const prompt = customPrompt.length > 0
      ? customPrompt
      : await generateImagePromptFromName(simuladoName);

    const seed = Math.floor(Math.random() * 999_999);
    const { dataUrl } = await fetchPollinationsImage(prompt, seed, model);

    return NextResponse.json({ prompt, dataUrl, seed });
  } catch (err) {
    const status = err instanceof AiNotConfiguredError ? 503 : 502;
    const message = err instanceof Error ? err.message : "Erro ao gerar arte do simulado.";
    return NextResponse.json({ error: message }, { status });
  }
}
