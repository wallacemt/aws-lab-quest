import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { requestAiCandidates, aiSuggestionErrorResponse } from "@/lib/ai-suggestion";

type RawCandidate = { title?: string };

export type WeeklyChallengeSuggestion = { title: string };

function buildPrompt(pastTitles: string[], count: number): string {
  const titleLines = pastTitles.map((t) => `- ${t}`).join("\n");

  return [
    "Voce e um game designer sugerindo titulos tematicos para o Desafio Semanal de uma plataforma gamificada de estudos AWS.",
    "O desafio ja e gerado automaticamente (um conjunto de questoes por semana); o titulo e so o nome de exibicao, tematico e curto.",
    "Titulos de semanas anteriores:",
    titleLines || "(nenhum ainda)",
    "",
    `Sugira ${count} titulos NOVOS, curtos (ate 6 palavras), no estilo "Semana de/da ...", sem repetir os anteriores.`,
    "",
    "Responda SOMENTE com um JSON no formato:",
    '{"candidates":[{"title":"..."}]}',
    "Sem markdown, sem explicacao, sem texto fora do JSON.",
  ].join("\n");
}

function sanitizeCandidate(raw: RawCandidate): WeeklyChallengeSuggestion | null {
  if (!raw.title?.trim()) return null;
  return { title: raw.title.trim() };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { count?: number };
  const count = body.count && body.count > 0 && body.count <= 5 ? body.count : 3;

  const pastChallenges = await prisma.weeklyChallenge.findMany({
    where: { title: { not: null } },
    select: { title: true },
    orderBy: { weekStart: "desc" },
    take: 10,
  });
  const pastTitles = pastChallenges.map((c) => c.title).filter((t): t is string => t !== null);

  const prompt = buildPrompt(pastTitles, count);

  try {
    const candidates = await requestAiCandidates({
      context: "WEEKLY_CHALLENGE_SUGGESTION",
      prompt,
      parseCandidates: (parsed) => {
        const raw = (parsed as { candidates?: RawCandidate[] }).candidates;
        if (!Array.isArray(raw)) return [];
        return raw.map(sanitizeCandidate).filter((c): c is WeeklyChallengeSuggestion => c !== null);
      },
    });
    return NextResponse.json({ candidates });
  } catch (err) {
    return aiSuggestionErrorResponse(err);
  }
}
