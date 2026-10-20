import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  pickByDifficulty,
  computeDifficultyScore,
  resolveUniquePackIdentity,
  type PriorStage,
} from "@/lib/simulado-pack-generation";
import { uploadArtworkDataUrl } from "@/lib/simulado-pack-artwork";
import { fetchPollinationsImage, PIXEL_ART_STYLE_RULES } from "@/lib/pollinations";

const MAX_PACK_SIZE = 65;
const MIN_PACK_SIZE = 20;

export const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Cover art for AWS certification simulado pack "{{packName}}" ({{certCode}}). AWS cloud computing theme: data center, cloud infrastructure, server racks, digital circuits.\n\n${PIXEL_ART_STYLE_RULES}`;

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

async function generateArtwork(
  packName: string, certCode: string, certName: string,
  promptTemplate: string, pollinationsModel: string, packId: string,
): Promise<string | null> {
  try {
    const prompt = renderTemplate(promptTemplate, { packName, certCode, certName });
    const seed = Math.floor(Math.random() * 999_999);
    const { dataUrl } = await fetchPollinationsImage(prompt, seed, pollinationsModel);
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
    // ponytail: narrative generation now needs structured context (stage index,
    // prior stages, used names) to follow the Jornada do Heroi arc coherently —
    // no longer a free-text template the admin can override. Kept in the
    // response so the UI field stays informational without a frontend change.
    defaultNarrativePrompt: "Gerado automaticamente seguindo o roteiro da Jornada do Heroi (nao customizavel).",
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
      const stageTotal = existingCount + packsToCreate;

      const priorStages: PriorStage[] = generateNarrativeEnabled
        ? (
            await prisma.simuladoPack.findMany({
              where: { certificationPresetId: cert.id },
              select: { journeyNarrative: true },
              orderBy: { createdAt: "asc" },
            })
          )
            .map((p) => p.journeyNarrative as PriorStage | null)
            .filter((n): n is PriorStage => !!n?.stageName)
        : [];

      for (let i = 0; i < packsToCreate; i++) {
        const stageIndex = existingCount + i + 1;
        const selectedIds = pickByDifficulty(remaining, packSize);
        const selectedSet = new Set(selectedIds);
        const selectedQuestions = remaining.filter((q) => selectedSet.has(q.id));
        for (let j = remaining.length - 1; j >= 0; j--) {
          if (selectedSet.has(remaining[j]!.id)) remaining.splice(j, 1);
        }

        const identity = await resolveUniquePackIdentity({
          certCode: cert.code,
          certName: cert.name,
          stageIndex,
          stageTotal,
          priorStages: generateNarrativeEnabled ? priorStages : [],
          fallbackIndex: existingCount + i,
        });
        if (generateNarrativeEnabled && identity.stageName) {
          priorStages.push({ stageName: identity.stageName, awsContext: identity.awsContext });
        }
        const packName = identity.packName;

        const pack = await prisma.simuladoPack.create({
          data: {
            name: packName,
            certificationPresetId: cert.id,
            createdByUserId: adminResult.userId,
            questionCount: packSize,
            difficultyScore: computeDifficultyScore(selectedQuestions),
            active: true,
            questions: { create: selectedIds.map((questionId, position) => ({ questionId, position })) },
          },
          select: { id: true },
        });

        const update: Record<string, unknown> = {};
        const hasNarrative = generateNarrativeEnabled && !!identity.stageName;
        let hasArtwork = false;

        if (hasNarrative) {
          update.journeyNarrative = { stageName: identity.stageName, storyText: identity.storyText, awsContext: identity.awsContext };
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
