import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { TRIGGER_TYPES, validateTriggerParams, type TriggerParams, type TriggerType } from "@/lib/achievement-triggers";
import { deleteAchievementArtworkFromSupabase, resolveAchievementArtworkForStorage } from "@/lib/achievement-artwork";

type RouteParams = { params: Promise<{ achievementId: string }> };

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { achievementId } = await params;
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return NextResponse.json({ error: "Conquista nao encontrada." }, { status: 404 });

  return NextResponse.json({ achievement });
}

type UpdateAchievementBody = Partial<{
  code: string;
  name: string;
  description: string;
  rarity: string;
  target: number;
  displayOrder: number;
  active: boolean;
  triggerType: string;
  triggerParams: TriggerParams | null;
  imageUrl: string | null;
  generationPrompt: string | null;
}>;

function validateUpdateBody(body: UpdateAchievementBody): string | null {
  if (body.code !== undefined && !body.code.trim()) {
    return "code nao pode ser vazio.";
  }
  if (body.name !== undefined && !body.name.trim()) {
    return "name nao pode ser vazio.";
  }
  if (body.description !== undefined && !body.description.trim()) {
    return "description nao pode ser vazio.";
  }
  if (body.rarity !== undefined && !RARITIES.includes(body.rarity)) {
    return `rarity deve ser uma de: ${RARITIES.join(", ")}.`;
  }
  if (body.target !== undefined && (typeof body.target !== "number" || body.target <= 0)) {
    return "target deve ser um numero maior que 0.";
  }
  if (body.triggerType !== undefined && !TRIGGER_TYPES.includes(body.triggerType as TriggerType)) {
    return `triggerType deve ser um de: ${TRIGGER_TYPES.join(", ")}.`;
  }
  if (body.triggerType !== undefined || body.triggerParams !== undefined) {
    // triggerParams can only be validated together with a known triggerType.
    if (body.triggerType !== undefined) {
      return validateTriggerParams(body.triggerType as TriggerType, body.triggerParams);
    }
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { achievementId } = await params;

  let body: UpdateAchievementBody;
  try {
    body = (await request.json()) as UpdateAchievementBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateUpdateBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const existing = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!existing) return NextResponse.json({ error: "Conquista nao encontrada." }, { status: 404 });

  try {
    let imageUrl: string | null | undefined;
    if (body.imageUrl !== undefined) {
      imageUrl = await resolveAchievementArtworkForStorage(body.imageUrl, existing.id);
      if (imageUrl !== existing.imageUrl && existing.imageUrl) {
        await deleteAchievementArtworkFromSupabase(existing.imageUrl).catch(() => undefined);
      }
    }

    const achievement = await prisma.achievement.update({
      where: { id: achievementId },
      data: {
        code: body.code?.trim(),
        name: body.name?.trim(),
        description: body.description?.trim(),
        rarity: body.rarity,
        target: body.target,
        displayOrder: body.displayOrder,
        active: body.active,
        triggerType: body.triggerType,
        triggerParams:
          body.triggerParams !== undefined ? ((body.triggerParams ?? Prisma.JsonNull) as Prisma.InputJsonValue) : undefined,
        imageUrl,
        generationPrompt: body.generationPrompt,
      },
    });

    return NextResponse.json({ achievement });
  } catch (err) {
    // instanceof Prisma.PrismaClientKnownRequestError is unreliable here — Turbopack can load
    // a separate module instance of @prisma/client per route, breaking class identity. Duck-type instead.
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Ja existe uma conquista com esse code." }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Erro ao atualizar conquista.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { achievementId } = await params;
  const existing = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!existing) return NextResponse.json({ error: "Conquista nao encontrada." }, { status: 404 });

  // Soft delete only: UserAchievement rows reference this achievement, and re-enabling
  // must be possible without losing users' existing progress/unlock history.
  const achievement = await prisma.achievement.update({
    where: { id: achievementId },
    data: { active: false },
  });

  return NextResponse.json({ achievement });
}
