import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { requestAiCandidates, aiSuggestionErrorResponse } from "@/lib/ai-suggestion";

type RawUnlockRule = {
  sessionType?: string;
  minScorePercent?: number;
};

type RawStage = {
  title?: string;
  topic?: string | null;
  awsServiceCode?: string | null;
  unlockRule?: RawUnlockRule | null;
};

type RawCandidate = {
  name?: string;
  description?: string;
  certificationCode?: string | null;
  stages?: RawStage[];
};

export type TrailStageSuggestion = {
  title: string;
  topic: string | null;
  awsServiceId: string | null;
  unlockRule: { sessionType: "KC" | "SIMULADO"; minScorePercent: number } | null;
};

export type TrailSuggestion = {
  name: string;
  description: string;
  certificationPresetId: string | null;
  stages: TrailStageSuggestion[];
};

const MAX_STAGES_PER_TRAIL = 6;

function buildPrompt(
  existingChains: { name: string; description: string | null }[],
  certPresets: { code: string; name: string }[],
  awsServices: { code: string; name: string }[],
  count: number,
): string {
  const chainLines = existingChains.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
  const certLines = certPresets.map((c) => `- ${c.code} | ${c.name}`).join("\n");
  const serviceLines = awsServices.map((s) => `- ${s.code} | ${s.name}`).join("\n");

  return [
    "Voce e um game designer sugerindo novas trilhas de estudo (quest chains) para uma plataforma gamificada de estudos AWS.",
    "Trilhas ja existentes:",
    chainLines || "(nenhuma ainda)",
    "",
    "Certificacoes AWS cadastradas na plataforma:",
    certLines || "(nenhuma cadastrada)",
    "",
    "Servicos AWS cadastrados na plataforma:",
    serviceLines || "(nenhum cadastrado)",
    "",
    `Sugira ${count} trilhas NOVAS que ainda nao existem, priorizando certificacoes ainda sem trilha dedicada.`,
    "Cada trilha precisa de um nome curto, uma descricao de 1-2 frases, e uma sequencia de 3 a " +
      `${MAX_STAGES_PER_TRAIL} estagios (stages) em ordem progressiva de dificuldade.`,
    "Cada estagio precisa de um titulo curto e, se fizer sentido, um servico AWS (awsServiceCode) OU um topico livre (topic), nunca os dois.",
    "O primeiro estagio de cada trilha deve ter unlockRule = null (desbloqueia direto).",
    "Estagios seguintes podem ter unlockRule para exigir desempenho minimo no estagio anterior, no formato " +
      '{"sessionType":"KC ou SIMULADO","minScorePercent":numero de 0 a 100}.',
    "",
    "Responda SOMENTE com um JSON no formato:",
    '{"candidates":[{"name":"...","description":"...","certificationCode":"CODIGO_OU_NULL","stages":[' +
      '{"title":"...","topic":"...OU_NULL","awsServiceCode":"CODIGO_OU_NULL","unlockRule":{"sessionType":"KC","minScorePercent":70}_OU_NULL}' +
      "]}]}",
    "O campo \"certificationCode\" deve ser exatamente um dos codigos listados acima, ou null se a trilha cobrir varias certificacoes.",
    "O campo \"awsServiceCode\" deve ser exatamente um dos codigos listados acima, ou null.",
    "Sem markdown, sem explicacao, sem texto fora do JSON.",
  ].join("\n");
}

function sanitizeStage(raw: RawStage, awsServiceCodes: Set<string>): TrailStageSuggestion | null {
  if (!raw.title?.trim()) return null;

  const sessionType = raw.unlockRule?.sessionType;
  const minScorePercent = raw.unlockRule?.minScorePercent;
  let unlockRule: TrailStageSuggestion["unlockRule"] = null;
  if ((sessionType === "KC" || sessionType === "SIMULADO") && typeof minScorePercent === "number") {
    unlockRule = { sessionType, minScorePercent: Math.min(100, Math.max(0, minScorePercent)) };
  }

  // QuestChainStage.awsServiceId has no FK relation to AwsService — it stores the
  // service CODE (e.g. "EC2"), used as-is as a human-readable subject elsewhere
  // (trail-illustration/explain/questions prompts, ServiceMultiSelect). Never
  // resolve it to the AwsService.id cuid, or it leaks the raw id to end users.
  return {
    title: raw.title.trim(),
    topic: raw.topic?.trim() || null,
    awsServiceId: raw.awsServiceCode && awsServiceCodes.has(raw.awsServiceCode) ? raw.awsServiceCode : null,
    unlockRule,
  };
}

function sanitizeCandidate(
  raw: RawCandidate,
  certPresetByCode: Map<string, string>,
  awsServiceCodes: Set<string>,
): TrailSuggestion | null {
  if (!raw.name?.trim() || !raw.description?.trim()) return null;

  const rawStages = Array.isArray(raw.stages) ? raw.stages : [];
  const stages = rawStages
    .map((s) => sanitizeStage(s, awsServiceCodes))
    .filter((s): s is TrailStageSuggestion => s !== null)
    .slice(0, MAX_STAGES_PER_TRAIL);

  return {
    name: raw.name.trim(),
    description: raw.description.trim(),
    certificationPresetId: raw.certificationCode ? (certPresetByCode.get(raw.certificationCode) ?? null) : null,
    stages,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { count?: number };
  const count = body.count && body.count > 0 && body.count <= 5 ? body.count : 3;

  const [existingChains, certPresets, awsServices] = await Promise.all([
    prisma.questChain.findMany({ select: { name: true, description: true } }),
    prisma.certificationPreset.findMany({ where: { active: true }, select: { id: true, code: true, name: true } }),
    prisma.awsService.findMany({ where: { active: true }, select: { code: true, name: true } }),
  ]);
  const certPresetByCode = new Map(certPresets.map((c) => [c.code, c.id]));
  const awsServiceCodes = new Set(awsServices.map((s) => s.code));

  const prompt = buildPrompt(existingChains, certPresets, awsServices, count);

  try {
    const candidates = await requestAiCandidates({
      context: "TRAIL_SUGGESTION",
      prompt,
      parseCandidates: (parsed) => {
        const raw = (parsed as { candidates?: RawCandidate[] }).candidates;
        if (!Array.isArray(raw)) return [];
        return raw
          .map((c) => sanitizeCandidate(c, certPresetByCode, awsServiceCodes))
          .filter((c): c is TrailSuggestion => c !== null);
      },
    });
    return NextResponse.json({ candidates });
  } catch (err) {
    return aiSuggestionErrorResponse(err);
  }
}
