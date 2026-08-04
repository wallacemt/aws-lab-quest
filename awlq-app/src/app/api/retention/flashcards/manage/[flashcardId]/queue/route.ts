import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

type QueueBody = {
  action?: unknown;
};

/**
 * PATCH /api/retention/flashcards/manage/[flashcardId]/queue
 * Toggles whether a flashcard is in the user's active review pipeline
 * ("esteira"). Unlike the sibling PATCH on /manage/[flashcardId], this works
 * on ANY flashcard the user owns — not just USER_CREATED — since the whole
 * point is to let the user curate error-generated cards into/out of rotation
 * too, without letting them edit content they didn't author.
 *
 *   action "add"    → dueAt = now, suspended = false (shows up next review)
 *   action "remove" → suspended = true (drops out of all future due queries)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ flashcardId: string }> }) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { flashcardId } = await params;

  const existing = await prisma.flashcard.findUnique({
    where: { id: flashcardId },
    select: { userId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Flashcard not found." }, { status: 404 });
  }
  if (existing.userId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: QueueBody;
  try {
    body = (await request.json()) as QueueBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action !== "add" && body.action !== "remove") {
    return NextResponse.json({ error: "action deve ser 'add' ou 'remove'." }, { status: 400 });
  }

  const data = body.action === "add" ? { dueAt: new Date(), suspended: false } : { suspended: true };

  const card = await prisma.flashcard.update({ where: { id: flashcardId }, data });

  return NextResponse.json({ card });
}
