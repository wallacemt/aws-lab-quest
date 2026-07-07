import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlashcardSource } from "@prisma/client";

const MY_CARDS_LIMIT = 200;

const FRONT_MAX_LENGTH = 300;
const BACK_MAX_LENGTH = 2000;
const HINT_MAX_LENGTH = 300;
const TOPIC_MAX_LENGTH = 100;

type CreateBody = {
  front?: unknown;
  back?: unknown;
  hint?: unknown;
  awsServiceId?: unknown;
  topic?: unknown;
};

/**
 * GET /api/retention/flashcards/manage
 * Lists flashcards the current user created themselves (source = USER_CREATED),
 * for the "manage my flashcards" screen. Not the due-review queue — see
 * GET /api/retention/flashcards for that.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cards = await prisma.flashcard.findMany({
    where: { userId: session.user.id, source: FlashcardSource.USER_CREATED },
    orderBy: { createdAt: "desc" },
    take: MY_CARDS_LIMIT,
  });

  return NextResponse.json({ cards });
}

/**
 * POST /api/retention/flashcards/manage
 * Creates a personal flashcard (source = USER_CREATED). Enters the SM-2
 * schedule immediately via the model's defaults (dueAt = now).
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.front !== "string" || typeof body.back !== "string") {
    return NextResponse.json({ error: "front e back sao obrigatorios." }, { status: 400 });
  }

  const front = body.front.trim();
  const back = body.back.trim();

  if (!front || !back) {
    return NextResponse.json({ error: "front e back nao podem ser vazios." }, { status: 400 });
  }
  if (front.length > FRONT_MAX_LENGTH || back.length > BACK_MAX_LENGTH) {
    return NextResponse.json(
      { error: `front deve ter no maximo ${FRONT_MAX_LENGTH} caracteres e back no maximo ${BACK_MAX_LENGTH}.` },
      { status: 400 },
    );
  }

  const hint = typeof body.hint === "string" ? body.hint.trim().slice(0, HINT_MAX_LENGTH) || null : null;
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, TOPIC_MAX_LENGTH) || null : null;
  const awsServiceId = typeof body.awsServiceId === "string" && body.awsServiceId ? body.awsServiceId : null;

  try {
    const card = await prisma.flashcard.create({
      data: {
        userId: session.user.id,
        front,
        back,
        hint,
        topic,
        awsServiceId,
        source: FlashcardSource.USER_CREATED,
      },
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch (err) {
    // P2003: invalid awsServiceId foreign key.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2003") {
      return NextResponse.json({ error: "awsServiceId invalido." }, { status: 400 });
    }
    throw err;
  }
}
