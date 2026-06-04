import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PostBody = {
  scope?: "session";
  sessionId?: string;
};

/**
 * POST /api/retention/flashcards/generate
 * Enqueues a flashcard generation job for the current user via WorkerTrigger.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    // Body is optional — proceed with defaults.
  }

  // IDOR guard (DEF-009): if a sessionId is provided, verify it belongs to the
  // current user before enqueueing generation scoped to that session.
  if (body.scope === "session" && body.sessionId) {
    const ownedSession = await prisma.studySessionHistory.findFirst({
      where: { id: body.sessionId, userId: session.user.id },
      select: { id: true },
    });
    if (!ownedSession) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const trigger = await prisma.workerTrigger.create({
    data: {
      action: "generate-flashcards",
      source: "manual",
      payload: {
        userId: session.user.id,
        sinceSessionId: body.scope === "session" ? (body.sessionId ?? undefined) : undefined,
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ enqueued: true, jobId: trigger.id });
}
