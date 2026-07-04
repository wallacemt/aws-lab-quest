import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FlashcardSource } from "@prisma/client";

const FRONT_MAX_LENGTH = 300;
const BACK_MAX_LENGTH = 2000;
const HINT_MAX_LENGTH = 300;
const TOPIC_MAX_LENGTH = 100;

type UpdateBody = {
  front?: unknown;
  back?: unknown;
  hint?: unknown;
  awsServiceId?: unknown;
  topic?: unknown;
};

/**
 * Loads the flashcard and enforces the IDOR guard: 404 if it doesn't exist,
 * 403 if it exists but belongs to another user or isn't user-created (mirrors
 * the ownership-check pattern in /api/user/cert-badges/[badgeId]/route.ts).
 */
async function loadOwnedUserCreatedCard(flashcardId: string, userId: string) {
  const existing = await prisma.flashcard.findUnique({
    where: { id: flashcardId },
    select: { userId: true, source: true },
  });

  if (!existing) {
    return { error: NextResponse.json({ error: "Flashcard not found." }, { status: 404 }) };
  }
  if (existing.userId !== userId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  if (existing.source !== FlashcardSource.USER_CREATED) {
    return {
      error: NextResponse.json(
        { error: "Apenas flashcards criados por voce podem ser editados ou excluidos." },
        { status: 403 },
      ),
    };
  }

  return { error: null };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ flashcardId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { flashcardId } = await params;

  const { error } = await loadOwnedUserCreatedCard(flashcardId, session.user.id);
  if (error) return error;

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.front === "string") {
    const front = body.front.trim();
    if (!front) return NextResponse.json({ error: "front nao pode ser vazio." }, { status: 400 });
    if (front.length > FRONT_MAX_LENGTH) {
      return NextResponse.json({ error: `front deve ter no maximo ${FRONT_MAX_LENGTH} caracteres.` }, { status: 400 });
    }
    data.front = front;
  }

  if (typeof body.back === "string") {
    const back = body.back.trim();
    if (!back) return NextResponse.json({ error: "back nao pode ser vazio." }, { status: 400 });
    if (back.length > BACK_MAX_LENGTH) {
      return NextResponse.json({ error: `back deve ter no maximo ${BACK_MAX_LENGTH} caracteres.` }, { status: 400 });
    }
    data.back = back;
  }

  if ("hint" in body) {
    data.hint = typeof body.hint === "string" ? body.hint.trim().slice(0, HINT_MAX_LENGTH) || null : null;
  }

  if ("topic" in body) {
    data.topic = typeof body.topic === "string" ? body.topic.trim().slice(0, TOPIC_MAX_LENGTH) || null : null;
  }

  if ("awsServiceId" in body) {
    data.awsServiceId = typeof body.awsServiceId === "string" && body.awsServiceId ? body.awsServiceId : null;
  }

  try {
    const card = await prisma.flashcard.update({ where: { id: flashcardId }, data });
    return NextResponse.json({ card });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2003") {
      return NextResponse.json({ error: "awsServiceId invalido." }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ flashcardId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { flashcardId } = await params;

  const { error } = await loadOwnedUserCreatedCard(flashcardId, session.user.id);
  if (error) return error;

  await prisma.flashcard.delete({ where: { id: flashcardId } });

  return NextResponse.json({ ok: true });
}
