import { prisma } from "@/lib/prisma";
import { callAI } from "@/lib/ai";
import { getPackNameByIndex, PACK_NAMES } from "@/lib/simulado-pack-names";

export type QuestionDifficulty = { id: string; difficulty: string };

const DIFFICULTY_RATIOS = { easy: 0.3, medium: 0.5, hard: 0.2 };
const DIFFICULTY_WEIGHT: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

export function pickByDifficulty(questions: QuestionDifficulty[], total: number): string[] {
  const pools = {
    easy: questions.filter((q) => q.difficulty === "easy"),
    medium: questions.filter((q) => q.difficulty === "medium"),
    hard: questions.filter((q) => q.difficulty === "hard"),
  };
  const targets = {
    easy: Math.round(total * DIFFICULTY_RATIOS.easy),
    medium: Math.round(total * DIFFICULTY_RATIOS.medium),
    hard: total - Math.round(total * DIFFICULTY_RATIOS.easy) - Math.round(total * DIFFICULTY_RATIOS.medium),
  };
  function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }
  const picked: string[] = [
    ...shuffle(pools.easy).slice(0, Math.min(targets.easy, pools.easy.length)).map((q) => q.id),
    ...shuffle(pools.medium).slice(0, Math.min(targets.medium, pools.medium.length)).map((q) => q.id),
    ...shuffle(pools.hard).slice(0, Math.min(targets.hard, pools.hard.length)).map((q) => q.id),
  ];
  if (picked.length < total) {
    const pickedSet = new Set(picked);
    shuffle(questions.filter((q) => !pickedSet.has(q.id))).slice(0, total - picked.length).forEach((q) => picked.push(q.id));
  }
  return shuffle(picked);
}

/** Weighted average of the pack's actual difficulty mix, scaled to the 1-10 difficultyScore band. */
export function computeDifficultyScore(selected: QuestionDifficulty[]): number {
  if (selected.length === 0) return 1;
  const weightedSum = selected.reduce((sum, q) => sum + (DIFFICULTY_WEIGHT[q.difficulty] ?? 2), 0);
  const avg = weightedSum / selected.length; // 1 (all easy) .. 3 (all hard)
  const scaled = Math.round(((avg - 1) / 2) * 9) + 1;
  return Math.min(10, Math.max(1, scaled));
}

export type PackIdentity = {
  characterName: string;
  packName: string;
  stageName: string;
  storyText: string;
  awsContext: string;
};

export type PriorStage = { stageName: string; awsContext: string };

async function generatePackIdentity(params: {
  certCode: string;
  certName: string;
  stageIndex: number;
  stageTotal: number;
  usedNames: string[];
  priorStages: PriorStage[];
}): Promise<PackIdentity | null> {
  const { certCode, certName, stageIndex, stageTotal, usedNames, priorStages } = params;

  const priorStagesText = priorStages.length > 0
    ? priorStages.map((s, i) => `${i + 1}. ${s.stageName} — ${s.awsContext}`).join("\n")
    : "Nenhum (este e o primeiro estagio da jornada).";
  const usedNamesText = usedNames.length > 0 ? usedNames.join(", ") : "Nenhum ainda.";

  const prompt = [
    "Voce e um roteirista de RPG criando o proximo estagio da 'Jornada do Heroi' de um simulado de certificacao AWS.",
    `Certificacao: ${certName} (${certCode}).`,
    `Este e o estagio ${stageIndex} de ${stageTotal} da jornada.`,
    "Estagios anteriores desta jornada (nao repita tema nem protagonista):",
    priorStagesText,
    "Nomes de personagens ja usados na plataforma (nao repita NENHUM destes):",
    usedNamesText,
    "Escolha UM personagem do universo geek (games, animes, filmes, series, mitologia pop) cuja personalidade ou poder combine metaforicamente com um dominio tecnico da AWS apropriado para este ponto da jornada.",
    "Quanto mais avancado o estagio (mais proximo do total), mais complexo/poderoso deve ser o tema tecnico e o personagem; o ultimo estagio da jornada deve remeter a um personagem 'chefao' (boss).",
    "Retorne APENAS um JSON valido, sem markdown, sem explicacao, com exatamente estes campos:",
    "{",
    '  "characterName": "nome do personagem escolhido (1-3 palavras)",',
    '  "stageName": "nome dramatico do estagio (2-5 palavras em portugues)",',
    '  "storyText": "texto narrativo motivacional de 2-4 frases em portugues no estilo RPG de aventura, mencionando o personagem",',
    '  "awsContext": "o dominio/servicos AWS centrais deste estagio, em 1-2 frases em portugues"',
    "}",
  ].join("\n");

  try {
    const text = (await callAI(prompt, "SIMULADO_MESSAGE")).trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const characterName = typeof parsed.characterName === "string" ? parsed.characterName.trim() : "";
    const stageName = typeof parsed.stageName === "string" ? parsed.stageName.trim() : "";
    const storyText = typeof parsed.storyText === "string" ? parsed.storyText.trim() : "";
    const awsContext = typeof parsed.awsContext === "string" ? parsed.awsContext.trim() : "";
    if (!characterName || !stageName) return null;
    return { characterName, packName: `Simulado ${characterName}`, stageName, storyText, awsContext };
  } catch {
    return null;
  }
}

/**
 * Generates a pack identity (character name + hero's-journey narrative) and guarantees
 * the character name isn't a repeat of a recently used pack name on the platform —
 * `getPackNameByIndex`'s per-certification index used to reset to 0 for every new
 * certification, which is why unrelated certs kept getting "Mario", "Luigi", "Wario"...
 */
export async function resolveUniquePackIdentity(params: {
  certCode: string;
  certName: string;
  stageIndex: number;
  stageTotal: number;
  priorStages: PriorStage[];
  fallbackIndex: number;
}): Promise<PackIdentity> {
  const recentPacks = await prisma.simuladoPack.findMany({
    select: { name: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const usedSet = new Set(
    recentPacks.map((p) => p.name.replace(/^Simulado\s+/i, "").trim().toLowerCase()),
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    const identity = await generatePackIdentity({
      certCode: params.certCode,
      certName: params.certName,
      stageIndex: params.stageIndex,
      stageTotal: params.stageTotal,
      usedNames: Array.from(usedSet),
      priorStages: params.priorStages,
    });
    if (identity && !usedSet.has(identity.characterName.toLowerCase())) {
      return identity;
    }
    if (identity) usedSet.add(identity.characterName.toLowerCase());
  }

  for (const name of PACK_NAMES) {
    if (!usedSet.has(name.toLowerCase())) {
      return { characterName: name, packName: `Simulado ${name}`, stageName: "", storyText: "", awsContext: "" };
    }
  }
  const fallbackName = getPackNameByIndex(params.fallbackIndex);
  return {
    characterName: fallbackName.replace(/^Simulado\s+/i, ""),
    packName: fallbackName,
    stageName: "",
    storyText: "",
    awsContext: "",
  };
}
