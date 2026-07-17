/**
 * Generates and stores a stage illustration (Pollinations + Supabase Storage),
 * following the same prompt/fetch pattern as the app's achievement/boss artwork
 * routes (awlq-app/src/app/api/admin/achievements|arena/bosses/generate-artwork).
 * Uses plain fetch instead of @supabase/supabase-js — the worker has no other
 * Supabase SDK usage, and a REST PUT is enough for a single-file upload.
 */

import { config } from "../config.js";
import { callAI } from "../ai.js";

const POLLINATIONS_BASE = "https://gen.pollinations.ai/image";
const DEFAULT_POLLINATIONS_MODEL = "flux";
const IMAGE_WIDTH = 512;
const IMAGE_HEIGHT = 512;
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;

export const TRAIL_ILLUSTRATION_BUCKET = "aws-lab-quest";
export const TRAIL_ILLUSTRATION_PREFIX = "trails";

export type StageIllustrationContext = {
  stageId: string;
  title: string;
  topic: string | null;
  awsServiceId: string | null;
  chainName: string;
};

export async function generateStageIllustrationPrompt(stage: StageIllustrationContext): Promise<string> {
  const subject = stage.awsServiceId ?? stage.topic ?? stage.title;

  const aiPrompt = [
    "Voce e um diretor de arte criando a ilustracao de um estagio de trilha de estudos para uma plataforma gamificada de certificacoes AWS.",
    `Trilha: "${stage.chainName}". Estagio: "${stage.title}" (${subject}).`,
    "Gere UM unico prompt em ingles para um modelo de geracao de imagem (flux).",
    "Requisitos obrigatorios do prompt:",
    "- Estilo pixel-art retro, composicao de cena/icone tematico, nao um badge circular.",
    "- A cena deve ter relacao visual clara com o servico/topico AWS do estagio.",
    "- Pode incluir elementos da Amazon Web Services (AWS) e nuvem (cloud, servidores, icones de servico) quando fizer sentido.",
    "- Sem texto, sem letras, sem logos de marcas reais.",
    "- Composicao centralizada para formato quadrado 512x512, fundo simples, alto contraste.",
    "Responda SOMENTE com o prompt final, sem aspas, sem prefixos, sem explicacao.",
  ].join("\n");

  const text = (await callAI(aiPrompt, "WORKER_TRAIL_ILLUSTRATION")).trim();

  const cleaned = text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^prompt[:\-\s]+/i, "")
    .trim();

  if (!cleaned) {
    throw new Error("IA retornou um prompt vazio.");
  }

  return cleaned;
}

export async function fetchPollinationsImage(
  prompt: string,
  seed: number,
  model: string = DEFAULT_POLLINATIONS_MODEL
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!config.pollinations.apiKey) {
    throw new Error("POLLINATIONS_API_KEY nao configurada.");
  }

  const encoded = encodeURIComponent(prompt);
  const url = `${POLLINATIONS_BASE}/${encoded}?model=${model}&width=${IMAGE_WIDTH}&height=${IMAGE_HEIGHT}&seed=${seed}&key=${config.pollinations.apiKey}`;

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const mimeType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
      return { buffer: Buffer.from(arrayBuffer), mimeType };
    }

    lastError = `${res.status} ${res.statusText}`;
    if (attempt < MAX_FETCH_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  throw new Error(`Falha ao gerar imagem no Pollinations: ${lastError}`);
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadStageIllustration(
  buffer: Buffer,
  mimeType: string,
  stageId: string
): Promise<string> {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nao configuradas.");
  }

  const ext = EXT_BY_MIME[mimeType] ?? "jpg";
  const path = `${TRAIL_ILLUSTRATION_PREFIX}/${stageId}/${Date.now()}.${ext}`;
  const uploadUrl = `${config.supabase.url}/storage/v1/object/${TRAIL_ILLUSTRATION_BUCKET}/${path}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.supabase.serviceRoleKey}`,
      "apikey": config.supabase.serviceRoleKey,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Falha ao subir ilustracao para o Supabase: ${res.status} ${detail}`);
  }

  return `${config.supabase.url}/storage/v1/object/public/${TRAIL_ILLUSTRATION_BUCKET}/${path}`;
}
