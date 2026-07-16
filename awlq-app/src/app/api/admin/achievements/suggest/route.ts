import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { callAI, extractJsonObject, AiNotConfiguredError } from "@/lib/ai";
import { TRIGGER_TYPES, validateTriggerParams, type TriggerParams, type TriggerType } from "@/lib/achievement-triggers";

type RawCandidate = {
  name?: string;
  description?: string;
  rarity?: string;
  triggerType?: string;
  triggerParams?: TriggerParams | null;
  target?: number;
};

export type AchievementSuggestion = {
  name: string;
  description: string;
  rarity: string;
  triggerType: TriggerType;
  triggerParams: TriggerParams | null;
  target: number;
};

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const MAX_ATTEMPTS = 3;

function buildPrompt(catalog: { code: string; name: string; rarity: string; triggerType: string }[], count: number): string {
  const catalogLines = catalog
    .map((a) => `- ${a.code} | ${a.name} | rarity=${a.rarity} | triggerType=${a.triggerType}`)
    .join("\n");

  return [
    "Voce e um game designer sugerindo novas conquistas (achievements) para uma plataforma gamificada de estudos AWS.",
    "Conquistas ja existentes:",
    catalogLines || "(nenhuma ainda)",
    "",
    `Sugira ${count} conquistas NOVAS que ainda nao existem no catalogo acima, cobrindo lacunas`,
    "(raridades sub-representadas e tipos de gatilho pouco usados).",
    "",
    `O campo "triggerType" de cada sugestao DEVE ser exatamente um destes: ${TRIGGER_TYPES.join(", ")}.`,
    'Se o triggerType for "SESSION_COUNT" ou "SESSION_SCORE_COUNT", "triggerParams" precisa ter "sessionType" ("KC" ou "SIMULADO")',
    '(e "minScorePercent" de 0 a 100 no caso de SESSION_SCORE_COUNT).',
    'Se for "XP_AND_SESSION_SCORE_COMBO", "triggerParams" precisa ter "xpThreshold", "sessionType", "minScorePercent" e "sessionCountThreshold".',
    "Para os demais tipos, \"triggerParams\" deve ser null.",
    "",
    "Responda SOMENTE com um JSON no formato:",
    '{"candidates":[{"name":"...","description":"...","rarity":"common|uncommon|rare|epic|legendary","triggerType":"...","triggerParams":null,"target":1}]}',
    "Sem markdown, sem explicacao, sem texto fora do JSON.",
  ].join("\n");
}

function sanitizeCandidate(raw: RawCandidate): AchievementSuggestion | null {
  if (!raw.name?.trim() || !raw.description?.trim()) return null;
  if (!raw.triggerType || !TRIGGER_TYPES.includes(raw.triggerType as TriggerType)) return null;
  if (validateTriggerParams(raw.triggerType as TriggerType, raw.triggerParams)) return null;

  return {
    name: raw.name.trim(),
    description: raw.description.trim(),
    rarity: raw.rarity && RARITIES.includes(raw.rarity) ? raw.rarity : "common",
    triggerType: raw.triggerType as TriggerType,
    triggerParams: raw.triggerParams ?? null,
    target: typeof raw.target === "number" && raw.target > 0 ? raw.target : 1,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { count?: number };
  const count = body.count && body.count > 0 && body.count <= 5 ? body.count : 3;

  const catalog = await prisma.achievement.findMany({
    select: { code: true, name: true, rarity: true, triggerType: true },
    orderBy: { displayOrder: "asc" },
  });

  const prompt = buildPrompt(catalog, count);

  // ponytail: the model occasionally returns malformed JSON — retry a couple
  // of times before giving up, same pattern as the trails question route.
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const rawText = (await callAI(prompt, "ACHIEVEMENT_SUGGESTION")).trim();
      const jsonStr = extractJsonObject(rawText);
      if (!jsonStr) throw new Error("Resposta da IA nao e JSON valido.");

      const parsed = JSON.parse(jsonStr) as { candidates?: RawCandidate[] };
      if (!Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
        throw new Error("A IA nao retornou nenhuma sugestao.");
      }

      const candidates = parsed.candidates.map(sanitizeCandidate).filter((c): c is AchievementSuggestion => c !== null);
      if (candidates.length === 0) {
        throw new Error("Nenhuma sugestao da IA passou na validacao de triggerType/triggerParams.");
      }

      return NextResponse.json({ candidates });
    } catch (err) {
      lastError = err;
    }
  }

  const status = lastError instanceof AiNotConfiguredError ? 503 : 502;
  const message = lastError instanceof Error ? lastError.message : "Erro ao gerar sugestoes.";
  return NextResponse.json({ error: message }, { status });
}
