import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { callAI, AiNotConfiguredError } from "@/lib/ai";

type GenerateBody = {
  achievementName?: string;
  customPrompt?: string;
  model?: string;
};

const POLLINATIONS_BASE = "https://gen.pollinations.ai/image";
const DEFAULT_POLLINATIONS_MODEL = "flux";
const IMAGE_WIDTH = 512;
const IMAGE_HEIGHT = 512;
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;

async function generateImagePromptFromName(achievementName: string): Promise<string> {
  const aiPrompt = [
    "Voce e um diretor de arte criando um badge de conquista (achievement) para uma plataforma gamificada de estudos AWS.",
    `Nome da conquista: "${achievementName}".`,
    "Gere UM unico prompt em ingles para um modelo de geracao de imagem (flux).",
    "Requisitos obrigatorios do prompt:",
    "- Estilo pixel-art retro, badge/emblema circular ou de escudo, icone limpo.",
    "- A cena deve ter relacao visual com o nome da conquista.",
    "- Pode incluir elementos da Amazon Web Services (AWS) e nuvem (cloud, servidores, icones de servico) quando fizer sentido.",
    "- Sem texto, sem letras, sem logos de marcas reais.",
    "- Composicao centralizada para formato quadrado 512x512, fundo simples, alto contraste.",
    "Responda SOMENTE com o prompt final, sem aspas, sem prefixos, sem explicacao.",
  ].join("\n");

  const text = (await callAI(aiPrompt, "ACHIEVEMENT_SUGGESTION")).trim();

  const cleaned = text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^prompt[:\-\s]+/i, "")
    .trim();

  if (!cleaned) {
    throw new Error("IA retornou um prompt vazio.");
  }

  return cleaned;
}

async function fetchPollinationsImage(prompt: string, seed: number, model: string): Promise<{ dataUrl: string }> {
  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    throw new Error("POLLINATIONS_API_KEY nao configurada.");
  }

  const encoded = encodeURIComponent(prompt);
  const url = `${POLLINATIONS_BASE}/${encoded}?model=${model}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&seed=${seed}&key=${apiKey}`;

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return { dataUrl: `data:${contentType};base64,${base64}` };
    }

    lastError = `${res.status} ${res.statusText}`;
    if (attempt < MAX_FETCH_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  throw new Error(`Falha ao gerar imagem no Pollinations: ${lastError}`);
}

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => ({}))) as Partial<GenerateBody>;
  const achievementName = body.achievementName?.trim() ?? "";
  const customPrompt = body.customPrompt?.trim() ?? "";
  const model = body.model?.trim() || DEFAULT_POLLINATIONS_MODEL;

  if (!achievementName && !customPrompt) {
    return NextResponse.json(
      { error: "Informe achievementName ou customPrompt." },
      { status: 400 },
    );
  }

  try {
    const prompt = customPrompt.length > 0
      ? customPrompt
      : await generateImagePromptFromName(achievementName);

    const seed = Math.floor(Math.random() * 999_999);
    const { dataUrl } = await fetchPollinationsImage(prompt, seed, model);

    return NextResponse.json({ prompt, dataUrl, seed });
  } catch (err) {
    const status = err instanceof AiNotConfiguredError ? 503 : 502;
    const message = err instanceof Error ? err.message : "Erro ao gerar arte da conquista.";
    return NextResponse.json({ error: message }, { status });
  }
}
