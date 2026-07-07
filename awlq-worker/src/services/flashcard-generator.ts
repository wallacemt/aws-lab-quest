/**
 * Builds Flashcard rows from a user's StudySessionHistory.
 *
 * Design: generates flashcards WITHOUT AI — front = statement, back = correct option + explanation.
 * AI-source cards (AI_EXPLANATION) are a future path, not triggered here.
 * Respects per-user dailyFlashcardCap to prevent DB/UI flooding (RNF-09).
 */

import { FlashcardSource } from "@prisma/client";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";

// Slow-answer threshold in ms: answers above this trigger a SLOW_ANSWER flashcard.
const SLOW_ANSWER_THRESHOLD_MS = 30_000;

// Front text is truncated so cards stay scannable.
const FRONT_MAX_CHARS = 300;

type AnswerSnapshotItem = {
  questionId?: string;
  correct?: boolean;
  responseTimeMs?: number;
  flaggedForReview?: boolean;
  selectedOption?: string;
};

type EligibleAnswer = {
  questionId: string;
  source: FlashcardSource;
};

/**
 * Derives the flashcard source from a single answer snapshot entry.
 * Returns null if the answer does not qualify for any flashcard type.
 */
function deriveSource(item: AnswerSnapshotItem): FlashcardSource | null {
  if (item.flaggedForReview) return "REVIEW_FLAG";
  if (item.correct === false) return "WRONG_ANSWER";
  if (typeof item.responseTimeMs === "number" && item.responseTimeMs > SLOW_ANSWER_THRESHOLD_MS) {
    return "SLOW_ANSWER";
  }
  return null;
}

/**
 * Collects eligible question/source pairs from sessions since a given session id (or all).
 * Deduplicates by questionId so the same question doesn't produce two cards in one sweep.
 */
async function collectEligibleAnswers(userId: string, sinceSessionId?: string): Promise<EligibleAnswer[]> {
  const whereClause = sinceSessionId
    ? { userId, id: sinceSessionId }
    : { userId, anonymized: false };

  const sessions = await prisma.studySessionHistory.findMany({
    where: whereClause,
    select: { answersSnapshot: true },
    orderBy: { completedAt: "desc" },
    take: 20, // cap to avoid processing unbounded history in one sweep
  });

  const seen = new Map<string, FlashcardSource>();

  for (const session of sessions) {
    const snapshot = session.answersSnapshot as AnswerSnapshotItem[];
    if (!Array.isArray(snapshot)) continue;

    for (const item of snapshot) {
      if (!item.questionId) continue;
      if (seen.has(item.questionId)) continue;

      const source = deriveSource(item);
      if (source) {
        seen.set(item.questionId, source);
      }
    }
  }

  return Array.from(seen.entries()).map(([questionId, source]) => ({ questionId, source }));
}

/**
 * Counts flashcards created for a user today to enforce dailyFlashcardCap.
 */
async function countCreatedToday(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.flashcard.count({
    where: { userId, createdAt: { gte: startOfDay } },
  });
}

/**
 * Generates and persists flashcards for a user from their recent wrong/slow/flagged answers.
 * Skips cards that already exist (unique constraint on userId + sourceQuestionId + source).
 * Respects the user's dailyFlashcardCap.
 *
 * @returns The number of new flashcards created.
 */
export async function generateFlashcardsForUser(userId: string, sinceSessionId?: string): Promise<number> {
  // Fetch user cap and target exam date for SM-2 context (stored but used on review, not here).
  const behaviorProfile = await prisma.userBehaviorProfile.findUnique({
    where: { userId },
    select: { dailyFlashcardCap: true },
  });

  const dailyCap = behaviorProfile?.dailyFlashcardCap ?? 30;
  const alreadyCreatedToday = await countCreatedToday(userId);
  const remainingCap = dailyCap - alreadyCreatedToday;

  if (remainingCap <= 0) {
    logger.info({ userId, dailyCap }, "flashcard-generator: daily cap reached, skipping");
    return 0;
  }

  const eligible = await collectEligibleAnswers(userId, sinceSessionId);
  if (eligible.length === 0) return 0;

  // Fetch the source questions in a single query.
  const questionIds = eligible.map((e) => e.questionId);
  const questions = await prisma.studyQuestion.findMany({
    where: { id: { in: questionIds }, active: true },
    select: {
      id: true,
      statement: true,
      correctOption: true,
      topic: true,
      awsServiceId: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
      explanationA: true,
      explanationB: true,
      explanationC: true,
      explanationD: true,
      explanationE: true,
    },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Fetch existing flashcards for these questions to skip duplicates.
  const existingCards = await prisma.flashcard.findMany({
    where: { userId, sourceQuestionId: { in: questionIds } },
    select: { sourceQuestionId: true, source: true },
  });

  const existingKeys = new Set(
    existingCards.map((c) => `${c.sourceQuestionId}::${c.source}`)
  );

  let created = 0;

  for (const { questionId, source } of eligible) {
    if (created >= remainingCap) break;

    const key = `${questionId}::${source}`;
    if (existingKeys.has(key)) continue;

    const question = questionMap.get(questionId);
    if (!question) continue;

    const { front, back, hint } = buildCardContent(question, source);

    try {
      await prisma.flashcard.create({
        data: {
          userId,
          sourceQuestionId: questionId,
          awsServiceId: question.awsServiceId ?? null,
          topic: question.topic ?? null,
          front,
          back,
          hint,
          source,
        },
      });

      existingKeys.add(key); // guard against duplicates within the same sweep
      created += 1;
    } catch (err: unknown) {
      // Unique constraint violation means the card already exists — safe to skip.
      const isUniqueViolation =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";

      if (!isUniqueViolation) {
        logger.error({ userId, questionId, source, err }, "flashcard-generator: unexpected error");
      }
    }
  }

  logger.info({ userId, created }, "flashcard-generator: done");
  return created;
}

// ─── Card content builders ────────────────────────────────────────────────────

type QuestionRow = {
  statement: string;
  correctOption: string;
  topic: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  explanationE: string | null;
};

function buildCardContent(
  question: QuestionRow,
  source: FlashcardSource,
): { front: string; back: string; hint: string | null } {
  const front = question.statement.slice(0, FRONT_MAX_CHARS);

  const correctLetter = question.correctOption.toUpperCase() as "A" | "B" | "C" | "D" | "E";
  const optionMap: Record<string, string> = {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
    E: question.optionE ?? "",
  };
  const explanationMap: Record<string, string | null> = {
    A: question.explanationA,
    B: question.explanationB,
    C: question.explanationC,
    D: question.explanationD,
    E: question.explanationE,
  };

  const correctText = optionMap[correctLetter] ?? "";
  const explanation = explanationMap[correctLetter] ?? null;

  let back = `Resposta correta: ${correctLetter}. ${correctText}`;
  if (explanation) {
    back += `\n\n${explanation}`;
  }

  // Source-specific prefix so users understand why they got this card.
  const sourcePrefix: Record<FlashcardSource, string> = {
    WRONG_ANSWER: "Você errou esta questão.",
    SLOW_ANSWER: "Você demorou muito para responder.",
    REVIEW_FLAG: "Você marcou esta questão para revisão.",
    AI_EXPLANATION: "",
    MEMORY_RECOVERY: "Você acertou esta questão há muito tempo.",
    // Never produced by this generator (built from StudyQuestion answers) —
    // USER_CREATED and DEFAULT_DECK cards are created directly, not derived
    // from a wrong/slow/flagged answer. Present only to satisfy exhaustiveness.
    USER_CREATED: "",
    DEFAULT_DECK: "",
  };

  const prefix = sourcePrefix[source];
  const fullBack = prefix ? `${prefix}\n\n${back}` : back;

  return { front, back: fullBack, hint: question.topic ?? null };
}
