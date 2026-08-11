import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { listJourneys, startNewJourney } from "@/lib/certification-journey";

type PostBody = {
  certificationPresetId?: string | null;
  certificationLabel?: string;
};

/**
 * GET /api/journeys
 * Lists every journey (active + archived) for the current user, newest first.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const journeys = await listJourneys(auth.user.id);
  return NextResponse.json({ journeys });
}

/**
 * POST /api/journeys
 * Archives the user's current active journey (if any) and opens a new one for
 * the given certification. XP/nível/histórico exibidos passam a contar do zero.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { user } = auth;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.certificationPresetId && !body.certificationLabel) {
    return NextResponse.json(
      { error: "certificationPresetId or certificationLabel is required." },
      { status: 400 }
    );
  }

  let certificationLabel = body.certificationLabel ?? "";

  if (body.certificationPresetId) {
    const preset = await prisma.certificationPreset.findUnique({
      where: { id: body.certificationPresetId },
      select: { id: true, name: true, active: true },
    });
    if (!preset || !preset.active) {
      return NextResponse.json({ error: "Certification preset not found." }, { status: 404 });
    }
    certificationLabel = certificationLabel || preset.name;
  }

  const journey = await startNewJourney(user.id, {
    certificationPresetId: body.certificationPresetId ?? null,
    certificationLabel,
  });

  // Every cache below is keyed by userId only and scoped implicitly to
  // "whatever journey is active right now" — switching journeys changes what
  // that means, so the stale entries must go or the UI keeps showing the
  // journey that was just archived.
  await cacheDel(
    CACHE_KEYS.userProfile(user.id),
    CACHE_KEYS.userPublicProfile(user.id),
    CACHE_KEYS.userQuestHistory(user.id),
    CACHE_KEYS.userStudyHistory(user.id),
  );

  return NextResponse.json({ journey }, { status: 201 });
}
