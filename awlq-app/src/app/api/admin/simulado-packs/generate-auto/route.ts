import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAiModelForContext } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { getPackNameByIndex } from "@/lib/simulado-pack-names";
import { uploadArtworkDataUrl } from "@/lib/simulado-pack-artwork";

const MAX_PACK_SIZE = 65;
const MIN_PACK_SIZE = 20;
const DIFFICULTY_RATIOS = { easy: 0.3, medium: 0.5, hard: 0.2 };
const POLLINATIONS_BASE = process.env.POLLINATIONS_BASE ?? "https://gen.pollinations.ai/image";
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

export const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Cover art for AWS certification simulado pack "{{packName}}" ({{certCode}}). AWS cloud computing theme: data center, cloud infrastructure, server racks, digital circuits. Dark tech aesthetic with glowing orange (#f97316) accents on deep navy background (#0f172a). No text, no letters, no brand logos. Cinematic digital illustration, centered square composition, vibrant high quality.`;

export const DEFAULT_NARRATIVE_PROMPT = `Voce e um escritor criativo que gera narrativas de jornada do heroi para simulados de certificacao AWS.
Pack: "{{packName}}" — Certificacao: {{certCode}} ({{certName}}).
Gere uma narrativa motivacional no estilo RPG retro.
Retorne APENAS um JSON valido, sem markdown, sem explicacao adicional, com exatamente estes campos:
{
  "stageName": "nome dramatico do estagio (2-4 palavras em portugues)",
  "storyText": "texto narrativo motivacional de 2-3 frases em portugues no estilo RPG de aventura",
  "awsContext": "contexto tecnico AWS para este estagio em 1-2 frases em portugues"
}`;

function pickByDifficulty(
  questions: { id: string; difficulty: string }[],
  total: number,
): string[] {
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

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

async function generateNarrative(
  packName: string, certCode: string, certName: string, promptTemplate: string,
): Promise<{ stageName: string; storyText: string; awsContext: string } | null> {
  try {
    const prompt = renderTemplate(promptTemplate, { packName, certCode, certName });
    const model = await getAiModelForContext("SIMULADO_MESSAGE");
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const stageName = typeof parsed.stageName === "string" ? parsed.stageName.trim() : "";
    const storyText = typeof parsed.storyText === "string" ? parsed.storyText.trim() : "";
    const awsContext = typeof parsed.awsContext === "string" ? parsed.awsContext.trim() : "";
    if (!stageName && !storyText) return null;
    return { stageName, storyText, awsContext };
  } catch { return null; }
}

async function generateArtwork(
  packName: string, certCode: string, certName: string,
  promptTemplate: string, pollinationsModel: string, packId: string,
): Promise<string | null> {
  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) return null;
  try {
    const prompt = renderTemplate(promptTemplate, { packName, certCode, certName });
    const seed = Math.floor(Math.random() * 999_999);
    const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?model=${encodeURIComponent(pollinationsModel)}&width=512&height=512&seed=${seed}&key=${apiKey}`;
    let dataUrl: string | null = null;
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
        dataUrl = `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
        break;
      }
      if (attempt < MAX_FETCH_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
    if (!dataUrl) return null;
    return await uploadArtworkDataUrl(dataUrl, packId);
  } catch { return null; }
}

async function getCertStats(certPresetId: string, packSize: number) {
  const usedIds = new Set(
    (await prisma.simuladoPackQuestion.findMany({
      where: { pack: { certificationPresetId: certPresetId, active: true } },
      select: { questionId: true },
    })).map((r) => r.questionId),
  );
  const available = await prisma.studyQuestion.count({
    where: {
      certificationPresetId: certPresetId,
      active: true,
      usage: { in: ["SIMULADO", "BOTH"] },
      id: { notIn: Array.from(usedIds) },
    },
  });
  return { available, packsPossible: Math.floor(available / packSize) };
}

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { searchParams } = new URL(request.url);
  const certCode = searchParams.get("certificationCode")?.trim() ?? "";
  const rawSize = Number(searchParams.get("packSize") ?? MAX_PACK_SIZE);
  const packSize = Math.min(MAX_PACK_SIZE, Math.max(MIN_PACK_SIZE, Number.isFinite(rawSize) ? rawSize : MAX_PACK_SIZE));

  const certs = await prisma.certificationPreset.findMany({
    where: certCode ? { code: certCode } : {},
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  const certifications = await Promise.all(
    certs.map(async (cert) => {
      const { available, packsPossible } = await getCertStats(cert.id, packSize);
      return { code: cert.code, name: cert.name, available, packsPossible };
    }),
  );

  return NextResponse.json({
    certifications,
    totalPacksPossible: certifications.reduce((s, c) => s + c.packsPossible, 0),
    packSize,
    defaultImagePromptTemplate: DEFAULT_IMAGE_PROMPT_TEMPLATE,
    defaultNarrativePrompt: DEFAULT_NARRATIVE_PROMPT,
  });
}

type AutoGenerateBody = {
  certificationCode?: string;
  packSize?: number;
  generateArtwork?: boolean;
  pollinationsModel?: string;
  imagePromptTemplate?: string;
  generateNarrative?: boolean;
  narrativePrompt?: string;
};

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => ({}))) as Partial<AutoGenerateBody>;
  const certCode = body.certificationCode?.trim() ?? "";
  const rawSize = Number(body.packSize ?? MAX_PACK_SIZE);
  const packSize = Math.min(MAX_PACK_SIZE, Math.max(MIN_PACK_SIZE, Number.isFinite(rawSize) ? rawSize : MAX_PACK_SIZE));
  const generateArtworkEnabled = body.generateArtwork === true;
  const pollinationsModel = body.pollinationsModel?.trim() || "flux";
  const imagePromptTemplate = body.imagePromptTemplate?.trim() || DEFAULT_IMAGE_PROMPT_TEMPLATE;
  const generateNarrativeEnabled = body.generateNarrative === true;
  const narrativePromptTemplate = body.narrativePrompt?.trim() || DEFAULT_NARRATIVE_PROMPT;

  const certs = await prisma.certificationPreset.findMany({
    where: certCode ? { code: certCode } : {},
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  if (certs.length === 0) {
    return NextResponse.json({ error: "Nenhuma certificacao encontrada." }, { status: 404 });
  }

  const createdPacks: Array<{ id: string; name: string; certCode: string; hasArtwork: boolean; hasNarrative: boolean }> = [];
  const errors: string[] = [];

  for (const cert of certs) {
    try {
      const usedIds = new Set(
        (await prisma.simuladoPackQuestion.findMany({
          where: { pack: { certificationPresetId: cert.id, active: true } },
          select: { questionId: true },
        })).map((r) => r.questionId),
      );
      const available = await prisma.studyQuestion.findMany({
        where: {
          certificationPresetId: cert.id,
          active: true,
          usage: { in: ["SIMULADO", "BOTH"] },
          id: { notIn: Array.from(usedIds) },
        },
        select: { id: true, difficulty: true },
      });

      if (available.length < packSize) continue;

      const existingCount = await prisma.simuladoPack.count({ where: { certificationPresetId: cert.id } });
      const packsToCreate = Math.floor(available.length / packSize);
      const remaining = [...available];
      let certPackIndex = 0;

      for (let i = 0; i < packsToCreate; i++) {
        const packName = getPackNameByIndex(existingCount + certPackIndex++);
        const selectedIds = pickByDifficulty(remaining, packSize);
        const selectedSet = new Set(selectedIds);
        for (let j = remaining.length - 1; j >= 0; j--) {
          if (selectedSet.has(remaining[j]!.id)) remaining.splice(j, 1);
        }

        const pack = await prisma.simuladoPack.create({
          data: {
            name: packName,
            certificationPresetId: cert.id,
            createdByUserId: adminResult.userId,
            questionCount: packSize,
            active: true,
            questions: { create: selectedIds.map((questionId, position) => ({ questionId, position })) },
          },
          select: { id: true },
        });

        const update: Record<string, unknown> = {};
        let hasNarrative = false;
        let hasArtwork = false;

        if (generateNarrativeEnabled) {
          const narrative = await generateNarrative(packName, cert.code, cert.name, narrativePromptTemplate);
          if (narrative) { update.journeyNarrative = narrative; hasNarrative = true; }
        }
        if (generateArtworkEnabled) {
          const artworkUrl = await generateArtwork(packName, cert.code, cert.name, imagePromptTemplate, pollinationsModel, pack.id);
          if (artworkUrl) { update.artworkUrl = artworkUrl; hasArtwork = true; }
        }
        if (Object.keys(update).length > 0) {
          await prisma.simuladoPack.update({ where: { id: pack.id }, data: update });
        }

        createdPacks.push({ id: pack.id, name: packName, certCode: cert.code, hasArtwork, hasNarrative });
      }
    } catch (err) {
      errors.push(`${cert.code}: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  }

  return NextResponse.json({ created: createdPacks.length, packs: createdPacks, errors });
}
