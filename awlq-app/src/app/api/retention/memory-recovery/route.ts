import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_RECOVERY_WINDOW_DAYS = 45;
const RECOVERY_ITEMS_LIMIT = 5;
const MEMORY_RECOVERY_CONFIG_KEY = "memory_recovery_window_days";

/**
 * GET /api/retention/memory-recovery
 * Returns questions that the user last answered correctly more than N days ago
 * (default 45, configurable via SystemConfig.memory_recovery_window_days).
 *
 * These are candidates for the "Você acertou há X dias — ainda lembra?" flow (RF-07).
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Read the recovery window from SystemConfig (admin-configurable, CA-18).
  const configRow = await prisma.systemConfig.findUnique({
    where: { key: MEMORY_RECOVERY_CONFIG_KEY },
    select: { value: true },
  });

  const windowDays = configRow ? parseInt(configRow.value, 10) || DEFAULT_RECOVERY_WINDOW_DAYS : DEFAULT_RECOVERY_WINDOW_DAYS;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  // Find sessions older than the cutoff to get question ids answered correctly.
  const oldSessions = await prisma.studySessionHistory.findMany({
    where: {
      userId,
      completedAt: { lte: cutoff },
      anonymized: false,
    },
    select: { answersSnapshot: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 50, // scan last 50 old sessions
  });

  type SnapshotItem = { questionId?: string; correct?: boolean };

  // Collect the most recent correct-answer date per question (from old sessions).
  const lastCorrectMap = new Map<string, Date>();
  for (const session of oldSessions) {
    const snapshot = session.answersSnapshot as SnapshotItem[];
    if (!Array.isArray(snapshot)) continue;
    for (const item of snapshot) {
      if (!item.questionId || item.correct !== true) continue;
      if (!lastCorrectMap.has(item.questionId)) {
        lastCorrectMap.set(item.questionId, session.completedAt);
      }
    }
  }

  if (lastCorrectMap.size === 0) {
    return NextResponse.json({ items: [] });
  }

  // Exclude questions the user answered (right or wrong) more recently.
  const recentSessions = await prisma.studySessionHistory.findMany({
    where: { userId, completedAt: { gt: cutoff }, anonymized: false },
    select: { answersSnapshot: true },
    take: 30,
  });

  const recentlyAnswered = new Set<string>();
  for (const session of recentSessions) {
    const snapshot = session.answersSnapshot as SnapshotItem[];
    if (!Array.isArray(snapshot)) continue;
    for (const item of snapshot) {
      if (item.questionId) recentlyAnswered.add(item.questionId);
    }
  }

  // Filter: old correct answers that weren't re-visited recently.
  const candidateIds = Array.from(lastCorrectMap.keys())
    .filter((id) => !recentlyAnswered.has(id))
    .slice(0, RECOVERY_ITEMS_LIMIT);

  if (candidateIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: candidateIds }, active: true },
    select: {
      id: true,
      statement: true,
      topic: true,
      difficulty: true,
      awsService: { select: { code: true, name: true } },
    },
  });

  const now = new Date();
  const items = questions.map((question) => {
    const lastCorrectAt = lastCorrectMap.get(question.id)!;
    const daysSince = Math.floor((now.getTime() - lastCorrectAt.getTime()) / (24 * 60 * 60 * 1000));
    return { question, lastCorrectAt, daysSince };
  });

  return NextResponse.json({ items });
}
