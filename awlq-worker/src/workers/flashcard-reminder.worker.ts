import { Worker } from "bullmq";
import { connection, FlashcardReminderJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";
import { sendEmail } from "../services/email.js";

const REMINDER_TRIGGER_CODE = "flashcard_due_reminder";
const COOLDOWN_HOURS = 20;
const MS_PER_HOUR = 3_600_000;
const PREVIEW_LIMIT = 5;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

/**
 * Daily digest reminder for due flashcards (issue #22 AC: "E-mail de lembrete
 * enviado para cards vencidos"). One email per user, not one per card.
 * Cooldown mirrors behavioral-email.worker.ts's pattern so a cron overlap or
 * manual re-run can't double-send within the same day.
 */
export function createFlashcardReminderWorker(): Worker<FlashcardReminderJobData> {
  return new Worker<FlashcardReminderJobData>(
    "flashcard-reminder",
    async () => {
      const now = new Date();

      const dueCards = await prisma.flashcard.findMany({
        where: { suspended: false, dueAt: { lte: now } },
        select: { userId: true, front: true },
      });

      if (dueCards.length === 0) {
        logger.info("flashcard-reminder: no due cards, skipping");
        return;
      }

      const frontsByUser = new Map<string, string[]>();
      for (const card of dueCards) {
        const fronts = frontsByUser.get(card.userId) ?? [];
        fronts.push(card.front);
        frontsByUser.set(card.userId, fronts);
      }

      let sent = 0;
      let skipped = 0;

      for (const [userId, fronts] of frontsByUser) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true, emailNotifications: true },
        });

        if (!user || !user.emailNotifications) {
          skipped++;
          continue;
        }

        const cooldownStart = new Date(now.getTime() - COOLDOWN_HOURS * MS_PER_HOUR);
        const recentEvent = await prisma.userEmailEvent.findFirst({
          where: { userId, triggerCode: REMINDER_TRIGGER_CODE, sentAt: { gte: cooldownStart } },
        });

        if (recentEvent) {
          skipped++;
          continue;
        }

        const count = fronts.length;
        const subject = `Voce tem ${count} flashcard${count > 1 ? "s" : ""} para revisar`;
        const previewItems = fronts
          .slice(0, PREVIEW_LIMIT)
          .map((front) => `<li>${escapeHtml(front)}</li>`)
          .join("");
        const remainder = count - PREVIEW_LIMIT;

        const html = `
          <p>Ola ${escapeHtml(user.name ?? "aluno")},</p>
          <p>Voce tem <strong>${count}</strong> flashcard${count > 1 ? "s" : ""} aguardando revisao:</p>
          <ul>${previewItems}</ul>
          ${remainder > 0 ? `<p>...e mais ${remainder}.</p>` : ""}
          <p>Entre no AWS Lab Quest para revisar agora.</p>
        `;

        try {
          await sendEmail({ to: user.email, subject, html });
          await prisma.userEmailEvent.create({
            data: { userId, triggerCode: REMINDER_TRIGGER_CODE, subject, sentAt: now },
          });
          sent++;
        } catch (err) {
          logger.warn({ err, userId }, "flashcard-reminder: failed to send");
          skipped++;
        }
      }

      logger.info({ sent, skipped, usersWithDue: frontsByUser.size }, "flashcard-reminder: done");
    },
    {
      connection,
      concurrency: 1,
    },
  );
}
