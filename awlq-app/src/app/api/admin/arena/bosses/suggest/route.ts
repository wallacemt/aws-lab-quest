import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { requestAiCandidates, aiSuggestionErrorResponse } from "@/lib/ai-suggestion";

type RawCandidate = {
  name?: string;
  code?: string;
  themeService?: string;
  maxHp?: number;
  damagePerCorrect?: number;
};

export type BossSuggestion = {
  name: string;
  code: string;
  themeService: string;
  maxHp: number;
  damagePerCorrect: number;
};

const DEFAULT_MAX_HP = 1000;
const DEFAULT_DAMAGE_PER_CORRECT = 10;

function buildPrompt(
  existingBosses: { name: string; code: string; themeService: string }[],
  services: { code: string; name: string }[],
  count: number,
): string {
  const bossLines = existingBosses.map((b) => `- ${b.code} | ${b.name} | tema=${b.themeService}`).join("\n");
  const serviceLines = services.map((s) => `- ${s.code} | ${s.name}`).join("\n");

  return [
    "Voce e um game designer sugerindo novos bosses para o modo Arena de uma plataforma gamificada de estudos AWS.",
    "Cada boss e tematizado em torno de um servico AWS e o jogador causa dano respondendo questoes corretamente sobre esse servico.",
    "Bosses ja existentes:",
    bossLines || "(nenhum ainda)",
    "",
    "Servicos AWS disponiveis na plataforma:",
    serviceLines || "(nenhum cadastrado)",
    "",
    `Sugira ${count} bosses NOVOS, priorizando servicos AWS que ainda nao tem boss.`,
    "Cada boss precisa de um nome tematico criativo (ex: um trocadilho ou personagem ligado ao servico), um codigo curto em snake_case, o codigo do servico AWS-alvo, maxHp (500 a 2000) e damagePerCorrect (5 a 50).",
    "",
    "Responda SOMENTE com um JSON no formato:",
    '{"candidates":[{"name":"...","code":"...","themeService":"CODIGO_DO_SERVICO","maxHp":1000,"damagePerCorrect":10}]}',
    "O campo \"themeService\" deve ser exatamente um dos codigos de servico listados acima.",
    "Sem markdown, sem explicacao, sem texto fora do JSON.",
  ].join("\n");
}

function sanitizeCandidate(raw: RawCandidate, serviceCodes: Set<string>): BossSuggestion | null {
  if (!raw.name?.trim() || !raw.code?.trim()) return null;
  if (!raw.themeService || !serviceCodes.has(raw.themeService)) return null;

  return {
    name: raw.name.trim(),
    code: raw.code.trim(),
    themeService: raw.themeService,
    maxHp: typeof raw.maxHp === "number" && raw.maxHp > 0 ? raw.maxHp : DEFAULT_MAX_HP,
    damagePerCorrect:
      typeof raw.damagePerCorrect === "number" && raw.damagePerCorrect > 0
        ? raw.damagePerCorrect
        : DEFAULT_DAMAGE_PER_CORRECT,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { count?: number };
  const count = body.count && body.count > 0 && body.count <= 5 ? body.count : 3;

  const [existingBosses, services] = await Promise.all([
    prisma.boss.findMany({ select: { name: true, code: true, themeService: true } }),
    prisma.awsService.findMany({ where: { active: true }, select: { code: true, name: true } }),
  ]);
  const serviceCodes = new Set(services.map((s) => s.code));

  const prompt = buildPrompt(existingBosses, services, count);

  try {
    const candidates = await requestAiCandidates({
      context: "ARENA_BOSS_SUGGESTION",
      prompt,
      parseCandidates: (parsed) => {
        const raw = (parsed as { candidates?: RawCandidate[] }).candidates;
        if (!Array.isArray(raw)) return [];
        return raw.map((c) => sanitizeCandidate(c, serviceCodes)).filter((c): c is BossSuggestion => c !== null);
      },
    });
    return NextResponse.json({ candidates });
  } catch (err) {
    return aiSuggestionErrorResponse(err);
  }
}
