/**
 * Deterministic mentor recommender — NO AI calls.
 *
 * Reads weak areas, false-belief signals, due flashcards, and recent session
 * scores to produce a ranked list of up to 5 prioritized action recommendations
 * for the given user. Results are persisted to MentorRecommendation (replacing
 * the previous batch for that user in a single transaction).
 *
 * Priority score formula:
 *   - WeakArea:           (1 - correctRate) * 100  + 20 bonus if also has FalseBeliefSignal
 *   - FalseBeliefSignal:  min(falseBeliefCount * 10, 80)   (if no matching WeakArea)
 *   - Due flashcards:     min(dueCount * 3, 60)
 *
 * Deduplication: only one recommendation per targetRef (first/highest score wins).
 */

import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";

type Recommendation = {
  rank: number;
  actionType: string;
  targetRef: string | null;
  title: string;
  rationale: string;
  priorityScore: number;
};

type ScoredCandidate = Omit<Recommendation, "rank">;

const MAX_RECOMMENDATIONS = 5;
const WEAK_AREA_THRESHOLD = 0.6;
const WEAK_AREA_MIN_ATTEMPTS = 3;

export async function computeMentorRecommendations(userId: string): Promise<void> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // ── Load all data sources in parallel ──────────────────────────────────────
  const [weakAreasByCode, falseBeliefs, dueCardsByServiceId] = await Promise.all([
    fetchUserWeakAreasByServiceCode(userId, twoWeeksAgo),
    prisma.falseBeliefSignal.findMany({
      where: { userId },
      orderBy: { falseBeliefCount: "desc" },
      take: 20,
    }),
    fetchDueFlashcardCountsByServiceId(userId),
  ]);

  // Resolve service id → code for false-belief and flashcard data
  const allServiceIds = new Set<string>();
  for (const fb of falseBeliefs) {
    if (fb.awsServiceId) allServiceIds.add(fb.awsServiceId);
  }
  for (const serviceId of dueCardsByServiceId.keys()) {
    if (serviceId !== "general") allServiceIds.add(serviceId);
  }

  const serviceCodeById = await resolveServiceCodes(Array.from(allServiceIds));

  const candidates: ScoredCandidate[] = [];

  // ── Score WeakArea candidates ───────────────────────────────────────────────
  for (const [serviceCode, correctRate] of weakAreasByCode) {
    let score = (1 - correctRate) * 100;

    // Bonus if the user also has a false-belief signal for this service
    const hasFalseBelief = falseBeliefs.some((fb) => {
      const fbCode = fb.awsServiceId ? (serviceCodeById.get(fb.awsServiceId) ?? fb.awsServiceId) : null;
      return fbCode === serviceCode || fb.topic === serviceCode;
    });
    if (hasFalseBelief) score = Math.min(100, score + 20);

    const errorRate = Math.round((1 - correctRate) * 100);

    candidates.push({
      actionType: "review_service",
      targetRef: serviceCode,
      title: `Revisar ${serviceCode.toUpperCase()}`,
      rationale: `Você errou ${errorRate}% das questões de ${serviceCode.toUpperCase()} nas últimas 2 semanas`,
      priorityScore: Math.round(score),
    });
  }

  // ── Score FalseBeliefSignal candidates (not already covered by WeakArea) ───
  const weakAreaRefs = new Set(weakAreasByCode.keys());

  for (const fb of falseBeliefs) {
    if (fb.falseBeliefCount === 0) continue;

    const serviceCode = fb.awsServiceId
      ? (serviceCodeById.get(fb.awsServiceId) ?? fb.awsServiceId)
      : (fb.topic ?? null);

    if (!serviceCode) continue;
    if (weakAreaRefs.has(serviceCode)) continue; // already scored with bonus

    const score = Math.min(80, fb.falseBeliefCount * 10);

    candidates.push({
      actionType: "kc",
      targetRef: serviceCode,
      title: `Reforçar ${serviceCode.toUpperCase()} com KC`,
      rationale: `Você marcou ${fb.falseBeliefCount} resposta(s) errada(s) com alta confiança em ${serviceCode.toUpperCase()}`,
      priorityScore: score,
    });
  }

  // ── Score due flashcard candidates ─────────────────────────────────────────
  for (const [serviceId, dueCount] of dueCardsByServiceId) {
    const serviceCode = serviceId !== "general"
      ? (serviceCodeById.get(serviceId) ?? serviceId)
      : "geral";

    const score = Math.min(60, dueCount * 3);

    candidates.push({
      actionType: "flashcards",
      targetRef: serviceCode,
      title: `${dueCount} flashcard(s) de ${serviceCode.toUpperCase()} para revisar`,
      rationale: `Você tem ${dueCount} flashcard(s) de ${serviceCode.toUpperCase()} com revisão agendada para hoje`,
      priorityScore: score,
    });
  }

  // ── Deduplicate by targetRef (keep highest score), then rank top-N ─────────
  const deduped = deduplicateByTargetRef(candidates);
  const sorted = deduped.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, MAX_RECOMMENDATIONS);

  const recommendations: Recommendation[] = sorted.map((c, index) => ({
    ...c,
    rank: index + 1,
  }));

  // ── Persist in a transaction: delete old, insert new ──────────────────────
  await prisma.$transaction([
    prisma.mentorRecommendation.deleteMany({ where: { userId } }),
    prisma.mentorRecommendation.createMany({
      data: recommendations.map((r) => ({
        userId,
        rank: r.rank,
        actionType: r.actionType,
        targetRef: r.targetRef,
        title: r.title,
        rationale: r.rationale,
        priorityScore: r.priorityScore,
      })),
    }),
  ]);

  logger.info({ userId, count: recommendations.length }, "mentor-recommender: persisted recommendations");
}

// ── Private helpers ────────────────────────────────────────────────────────

/**
 * Derives per-user weak areas directly from recent StudySessionHistory.
 * Returns a map of serviceCode → correctRate, limited to services with
 * at least MIN_ATTEMPTS and a correctRate below THRESHOLD.
 *
 * The snapshot's `correct` field (boolean) is set by the history route
 * when it stores the session; we rely on it here rather than re-evaluating.
 */
async function fetchUserWeakAreasByServiceCode(
  userId: string,
  since: Date,
): Promise<Map<string, number>> {
  const sessions = await prisma.studySessionHistory.findMany({
    where: { userId, completedAt: { gte: since }, anonymized: false },
    select: { answersSnapshot: true },
    take: 50,
  });

  if (sessions.length === 0) return new Map();

  const questionIds = new Set<string>();
  for (const s of sessions) {
    const snapshot = s.answersSnapshot as Array<{ questionId?: string }>;
    if (Array.isArray(snapshot)) {
      for (const item of snapshot) {
        if (item.questionId) questionIds.add(item.questionId);
      }
    }
  }

  if (questionIds.size === 0) return new Map();

  // Fetch service codes alongside question ids
  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: Array.from(questionIds) } },
    select: {
      id: true,
      questionAwsServices: {
        select: { service: { select: { code: true } } },
      },
    },
  });

  const codesByQuestionId = new Map<string, string[]>(
    questions.map((q) => [q.id, q.questionAwsServices.map((r) => r.service.code)]),
  );

  const acc = new Map<string, { correct: number; total: number }>();

  for (const s of sessions) {
    const snapshot = s.answersSnapshot as Array<{ questionId?: string; correct?: boolean }>;
    if (!Array.isArray(snapshot)) continue;

    for (const item of snapshot) {
      if (!item.questionId) continue;

      const codes = codesByQuestionId.get(item.questionId) ?? [];
      for (const code of codes) {
        const entry = acc.get(code) ?? { correct: 0, total: 0 };
        entry.total++;
        if (item.correct === true) entry.correct++;
        acc.set(code, entry);
      }
    }
  }

  const result = new Map<string, number>();
  for (const [code, { correct, total }] of acc) {
    if (total < WEAK_AREA_MIN_ATTEMPTS) continue;
    const rate = correct / total;
    if (rate < WEAK_AREA_THRESHOLD) result.set(code, rate);
  }

  return result;
}

/**
 * Counts due flashcards per AwsService id for the user.
 * Returns a map of serviceId → dueCount.
 */
async function fetchDueFlashcardCountsByServiceId(userId: string): Promise<Map<string, number>> {
  const now = new Date();
  const dueCards = await prisma.flashcard.findMany({
    where: { userId, suspended: false, dueAt: { lte: now } },
    select: { awsServiceId: true, topic: true },
  });

  const counts = new Map<string, number>();
  for (const card of dueCards) {
    const key = card.awsServiceId ?? card.topic ?? "general";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

/**
 * Batch-resolves AwsService.id → AwsService.code for the given id list.
 */
async function resolveServiceCodes(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const services = await prisma.awsService.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true },
  });

  return new Map(services.map((s) => [s.id, s.code]));
}

function deduplicateByTargetRef(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const seen = new Map<string, ScoredCandidate>();

  for (const candidate of candidates) {
    const key = candidate.targetRef ?? `__no_ref_${candidate.actionType}`;
    const existing = seen.get(key);
    if (!existing || candidate.priorityScore > existing.priorityScore) {
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}
