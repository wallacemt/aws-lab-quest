import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiModel, extractJsonObject } from "@/lib/ai";

type JourneyNarrative = {
  stageName: string;
  storyText: string;
  awsContext: string;
};

function narrativeFallback(packName: string, stageNumber: number, totalStages: number, isBoss: boolean): JourneyNarrative {
  if (isBoss) {
    return {
      stageName: "O Confronto Final",
      storyText: `A batalha decisiva se aproxima. Este é o desafio máximo que separa os aspirantes dos verdadeiros Cloud Champions. ${packName} representa o ápice do conhecimento AWS.`,
      awsContext: packName,
    };
  }
  const stageNames = [
    "O Chamado da Nuvem",
    "A Forja do Conhecimento",
    "O Labirinto dos Serviços",
    "A Caverna dos Segredos",
    "O Teste dos Campeões",
    "A Ascensão do Arquiteto",
    "O Portal da Sabedoria",
    "A Prova do Mestre",
  ];
  return {
    stageName: stageNames[(stageNumber - 1) % stageNames.length] ?? `Fase ${stageNumber}`,
    storyText: `Você está na fase ${stageNumber} de ${totalStages} da sua jornada rumo à certificação AWS. Cada questão respondida fortalece seu arsenal de conhecimento na nuvem.`,
    awsContext: packName,
  };
}

async function generateNarrative(
  certName: string,
  packName: string,
  stageNumber: number,
  totalStages: number,
  isBoss: boolean,
): Promise<JourneyNarrative> {
  const systemPrompt = `Você é o narrador épico do AWS Lab Quest, um jogo de estudos para certificações AWS com estética retro RPG. Gere uma narrativa temática para uma fase da jornada do herói. Responda APENAS com JSON válido, sem markdown, sem prefixo.`;
  const userPrompt = `Certificação: ${certName}
Pack: ${packName}
Fase: ${stageNumber} de ${totalStages}
${isBoss ? "Esta é a FASE BOSS — o desafio final da jornada." : ""}

Gere um JSON com exatamente estes campos:
{
  "stageName": "Nome épico da fase (5-8 palavras, estilo fantasy/RPG)",
  "storyText": "2-3 frases de flavour text temático AWS. Mencione conceitos da nuvem de forma narrativa.",
  "awsContext": "Serviço AWS principal relacionado a este pack (ex: Amazon S3, AWS Lambda)"
}`;

  try {
    const model = getAiModel();
    const result = await Promise.race([
      model.generateContent([systemPrompt, userPrompt]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
    ]);
    const text = result.response.text().trim();
    const jsonStr = extractJsonObject(text);
    if (!jsonStr) return narrativeFallback(packName, stageNumber, totalStages, isBoss);
    const parsed = JSON.parse(jsonStr) as Partial<JourneyNarrative>;
    if (parsed.stageName && parsed.storyText && parsed.awsContext) {
      return { stageName: parsed.stageName, storyText: parsed.storyText, awsContext: parsed.awsContext };
    }
    return narrativeFallback(packName, stageNumber, totalStages, isBoss);
  } catch {
    return narrativeFallback(packName, stageNumber, totalStages, isBoss);
  }
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const countOnly = searchParams.get("count") === "true";

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      certificationPresetId: true,
      certificationPreset: { select: { code: true, name: true } },
    },
  });

  if (!profile?.certificationPresetId) {
    return NextResponse.json({ stages: [], totalCount: 0, completedCount: 0, certName: null });
  }

  const packs = await prisma.simuladoPack.findMany({
    where: { certificationPresetId: profile.certificationPresetId, active: true },
    orderBy: { difficultyScore: "asc" },
    select: {
      id: true,
      name: true,
      difficultyScore: true,
      artworkUrl: true,
      questionCount: true,
      journeyNarrative: true,
    },
  });

  const totalCount = packs.length;

  if (countOnly) {
    return NextResponse.json({ totalCount });
  }

  if (totalCount === 0) {
    return NextResponse.json({ stages: [], totalCount: 0, completedCount: 0, certName: profile.certificationPreset?.name ?? null });
  }

  // Fetch which packs this user has completed
  const completedSessions = await prisma.studySessionHistory.findMany({
    where: { userId: session.user.id, sessionType: "SIMULADO", packId: { in: packs.map((p) => p.id) } },
    select: { packId: true },
  });
  const completedPackIds = new Set(completedSessions.map((s) => s.packId).filter(Boolean) as string[]);

  const completedCount = packs.filter((p) => completedPackIds.has(p.id)).length;
  const certName = profile.certificationPreset?.name ?? "AWS";

  // Find first incomplete stage index (for "current" progress)
  const maxDifficultyScore = Math.max(...packs.map((p) => p.difficultyScore));

  // Build stages with narratives (generate if missing)
  const stages = await Promise.all(
    packs.map(async (pack, index) => {
      const stageNumber = index + 1;
      const isBoss = pack.difficultyScore === maxDifficultyScore || pack.difficultyScore === 10;
      const completed = completedPackIds.has(pack.id);

      let narrative = pack.journeyNarrative as JourneyNarrative | null;
      if (!narrative || !narrative.stageName) {
        narrative = await generateNarrative(certName, pack.name, stageNumber, totalCount, isBoss);
        // Cache the narrative asynchronously (don't block response)
        void prisma.simuladoPack
          .update({ where: { id: pack.id }, data: { journeyNarrative: narrative } })
          .catch(() => undefined);
      }

      return {
        packId: pack.id,
        packName: pack.name,
        difficultyScore: pack.difficultyScore,
        artworkUrl: pack.artworkUrl ?? null,
        questionCount: pack.questionCount,
        stageNumber,
        isBoss,
        completed,
        narrative,
      };
    }),
  );

  // Current stage = first incomplete stage index (0-based), or last if all done
  const currentStageIndex = stages.findIndex((s) => !s.completed);

  return NextResponse.json({ stages, totalCount, completedCount, currentStageIndex, certName });
}
