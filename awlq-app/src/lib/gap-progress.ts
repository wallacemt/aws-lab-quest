import { prisma } from "@/lib/prisma";

export const GAP_CLEAR_THRESHOLD = 10;

export type GapAnswerResult = {
  awsServiceId: string | null;
  topic: string;
  isCorrect: boolean;
};

/**
 * Updates the consecutive-correct streak per (user, service/topic) gap.
 * A wrong answer zeroes the streak and reopens the gap; reaching the
 * threshold marks it cleared so it drops out of the weak-services list.
 */
export async function updateGapProgress(userId: string, answers: GapAnswerResult[]): Promise<void> {
  if (answers.length === 0) return;

  const byKey = new Map<string, GapAnswerResult>();
  for (const answer of answers) {
    byKey.set(`${answer.awsServiceId ?? ""}::${answer.topic}`, answer);
  }

  // Postgres unique indexes treat NULL as distinct, so a nullable awsServiceId
  // can't be targeted via the compound-unique upsert — find-then-write instead.
  await Promise.all(
    Array.from(byKey.values()).map(async (answer) => {
      const existing = await prisma.userGapProgress.findFirst({
        where: { userId, awsServiceId: answer.awsServiceId, topic: answer.topic },
        select: { id: true },
      });

      const data = answer.isCorrect
        ? { consecutiveCorrect: { increment: 1 }, cleared: false }
        : { consecutiveCorrect: 0, cleared: false };

      if (existing) {
        await prisma.userGapProgress.update({ where: { id: existing.id }, data });
      } else {
        await prisma.userGapProgress.create({
          data: {
            userId,
            awsServiceId: answer.awsServiceId,
            topic: answer.topic,
            consecutiveCorrect: answer.isCorrect ? 1 : 0,
            cleared: false,
          },
        });
      }
    }),
  );

  // Second pass: clamp + mark cleared once the increment crosses the threshold.
  // Done separately because Prisma can't compare an incremented field to a
  // constant in the same update.
  const clearedCandidates = Array.from(byKey.values()).filter((a) => a.isCorrect);
  if (clearedCandidates.length === 0) return;

  await Promise.all(
    clearedCandidates.map((answer) =>
      prisma.userGapProgress.updateMany({
        where: {
          userId,
          awsServiceId: answer.awsServiceId,
          topic: answer.topic,
          consecutiveCorrect: { gte: GAP_CLEAR_THRESHOLD },
        },
        data: { cleared: true, consecutiveCorrect: GAP_CLEAR_THRESHOLD },
      }),
    ),
  );
}
