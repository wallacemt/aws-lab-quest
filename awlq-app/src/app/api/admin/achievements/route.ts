import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { TRIGGER_TYPES, validateTriggerParams, type TriggerParams, type TriggerType } from "@/lib/achievement-triggers";
import { resolveAchievementArtworkForStorage } from "@/lib/achievement-artwork";

/**
 * GET /api/admin/achievements — list all achievements (admin manages active/inactive alike)
 * POST /api/admin/achievements — create an achievement
 */

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const achievements = await prisma.achievement.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ achievements });
}

type CreateAchievementBody = {
  code?: string;
  name?: string;
  description?: string;
  rarity?: string;
  target?: number;
  displayOrder?: number;
  active?: boolean;
  triggerType?: string;
  triggerParams?: TriggerParams | null;
  imageUrl?: string | null;
  generationPrompt?: string | null;
};

function validateCreateBody(body: CreateAchievementBody): string | null {
  if (!body.code?.trim() || !body.name?.trim() || !body.description?.trim()) {
    return "code, name e description sao obrigatorios.";
  }
  if (body.rarity !== undefined && !RARITIES.includes(body.rarity)) {
    return `rarity deve ser uma de: ${RARITIES.join(", ")}.`;
  }
  if (body.target !== undefined && (typeof body.target !== "number" || body.target <= 0)) {
    return "target deve ser um numero maior que 0.";
  }
  if (!body.triggerType || !TRIGGER_TYPES.includes(body.triggerType as TriggerType)) {
    return `triggerType deve ser um de: ${TRIGGER_TYPES.join(", ")}.`;
  }
  return validateTriggerParams(body.triggerType as TriggerType, body.triggerParams);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: CreateAchievementBody;
  try {
    body = (await request.json()) as CreateAchievementBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateCreateBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const imageUrl = await resolveAchievementArtworkForStorage(body.imageUrl ?? null, body.code!.trim());

    const achievement = await prisma.achievement.create({
      data: {
        code: body.code!.trim(),
        name: body.name!.trim(),
        description: body.description!.trim(),
        rarity: body.rarity ?? "common",
        target: body.target ?? 1,
        displayOrder: body.displayOrder ?? 0,
        active: body.active ?? true,
        triggerType: body.triggerType!,
        triggerParams: (body.triggerParams ?? undefined) as Prisma.InputJsonValue | undefined,
        imageUrl,
        generationPrompt: body.generationPrompt ?? null,
      },
    });

    return NextResponse.json({ achievement }, { status: 201 });
  } catch (err) {
    // instanceof Prisma.PrismaClientKnownRequestError is unreliable here — Turbopack can load
    // a separate module instance of @prisma/client per route, breaking class identity. Duck-type instead.
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Ja existe uma conquista com esse code." }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Erro ao criar conquista.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
