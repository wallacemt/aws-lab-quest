import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// LGPD Art. 18 — right to erasure / anonymization.
// Account data is anonymized rather than hard-deleted so that
// relational integrity is preserved for aggregate analytics.
export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const deletedEmail = `${randomUUID()}@deleted.invalid`;
  const deletedUsername = randomUUID();

  await prisma.$transaction([
    // Anonymize PII on the user row
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Usuário Removido",
        email: deletedEmail,
        username: deletedUsername,
        active: false,
        image: null,
      },
    }),
    // Remove profile (avatar, bgImage, preferences)
    prisma.userProfile.deleteMany({ where: { userId } }),
    // Revoke all active sessions
    prisma.session.deleteMany({ where: { userId } }),
    // Remove OAuth / password accounts
    prisma.account.deleteMany({ where: { userId } }),
    // LGPD F-01: explicitly delete Phase 1–4 user data tables.
    // The User row is updated (not hard-deleted) so onDelete: Cascade does not
    // fire. These deletes ensure all personal data is removed as required by
    // LGPD Art. 18 right-to-erasure obligations.
    prisma.flashcard.deleteMany({ where: { userId } }),
    // FlashcardReview rows cascade from Flashcard deletion above.
    prisma.falseBeliefSignal.deleteMany({ where: { userId } }),
    prisma.mentorRecommendation.deleteMany({ where: { userId } }),
    prisma.bossBattle.deleteMany({ where: { userId } }),
    prisma.weeklyChallengeEntry.deleteMany({ where: { userId } }),
    prisma.dailyQuizAttempt.deleteMany({ where: { userId } }),
    prisma.userBehaviorProfile.deleteMany({ where: { userId } }),
    prisma.questChainProgress.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
