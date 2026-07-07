/**
 * Default-deck materialization (EPIC #6 / issue #23).
 *
 * FlashcardTemplate is a global, admin-seeded catalog (see prisma/seed.ts).
 * Materializing means copying any template the user doesn't have yet into
 * their own Flashcard rows (source = DEFAULT_DECK) so it joins their SM-2
 * queue like any other card. Idempotent per user via templateId tracking.
 */
import { prisma } from "@/lib/prisma";
import { FlashcardSource } from "@prisma/client";

// ponytail: called on every GET /api/retention/flashcards — cheap once fully
// materialized (two selects, no writes). Move to a post-signup hook if this
// read path ever becomes hot enough to matter.
export async function materializeDefaultDeck(userId: string): Promise<void> {
  const templates = await prisma.flashcardTemplate.findMany({
    select: { id: true, awsServiceId: true, topic: true, front: true, back: true, hint: true },
  });
  if (templates.length === 0) return;

  const existing = await prisma.flashcard.findMany({
    where: { userId, templateId: { not: null } },
    select: { templateId: true },
  });
  const existingTemplateIds = new Set(existing.map((f) => f.templateId));

  const missing = templates.filter((t) => !existingTemplateIds.has(t.id));
  if (missing.length === 0) return;

  await prisma.flashcard.createMany({
    data: missing.map((t) => ({
      userId,
      templateId: t.id,
      awsServiceId: t.awsServiceId,
      topic: t.topic,
      front: t.front,
      back: t.back,
      hint: t.hint,
      source: FlashcardSource.DEFAULT_DECK,
    })),
    // Two concurrent first-loads for the same fresh user can both pass the
    // in-memory diff before either write lands. The @@unique([userId,
    // templateId]) constraint is what actually prevents the duplicate rows;
    // skipDuplicates just turns that race into a no-op instead of a P2002
    // throw (DEF-001).
    skipDuplicates: true,
  });
}
