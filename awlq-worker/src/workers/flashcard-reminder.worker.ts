import { Worker } from "bullmq";
import { connection, FlashcardReminderJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { logger } from "../shared/logger.js";
import { sendEmail, buildEmailContent } from "../services/email.js";

const REMINDER_TRIGGER_CODE = "flashcard_due_reminder";
const TEMPLATE_CODE = "flashcard-due-reminder";
const COOLDOWN_HOURS = 20;
const MS_PER_HOUR = 3_600_000;
const PREVIEW_LIMIT = 5;
const STATIC_LOGO_URL =
  "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/simulado-artwork/android-chrome-512x512.png";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

/**
 * Used only when no "flashcard-due-reminder" AdminEmailTemplate row exists yet
 * (e.g. right after deploy, before an admin has opened /admin/email once) —
 * keeps the reminder sending with the same branded look admins can later edit.
 */
function buildFallbackTemplate(): { subject: string; html: string } {
  return {
    subject: "Voce tem {{count}} flashcard{{plural}} para revisar",
    html: `
      <div style="margin:0;padding:24px;background:#0b1220;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#f8fafc;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:22px;background:linear-gradient(135deg,#0ea5e9,#22d3ee);text-align:center;">
              <img src="{{logo_url}}" alt="AWS Quest" width="72" height="72" style="display:block;margin:0 auto 10px auto;border-radius:16px;border:2px solid rgba(255,255,255,0.7);" />
              <h1 style="margin:8px 0 4px 0;font-size:22px;line-height:1.2;color:#082f49;">Hora de revisar, {{name}}!</h1>
              <p style="margin:0;font-size:13px;color:#0c4a6e;">{{count}} flashcard{{plural}} esperando por voce</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 22px;">
              {{card_list}}
              <div style="margin:20px 0 10px 0;text-align:center;">
                <a href="{{app_url}}/flashcards" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0f172a;color:#e2e8f0;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">Revisar agora</a>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
}

/** Groups due cards by owner so each user gets one digest, not one email per card. */
export function groupFrontsByUser(cards: Array<{ userId: string; front: string }>): Map<string, string[]> {
  const byUser = new Map<string, string[]>();
  for (const card of cards) {
    const fronts = byUser.get(card.userId) ?? [];
    fronts.push(card.front);
    byUser.set(card.userId, fronts);
  }
  return byUser;
}

/**
 * Gates sending on opt-out and the cooldown window. Mirrors
 * behavioral-email.worker.ts's pattern so a cron overlap or manual re-run
 * can't double-send within the same day.
 */
export function shouldSendReminder(params: {
  emailNotifications: boolean;
  lastReminderSentAt: Date | null;
  now: Date;
}): boolean {
  if (!params.emailNotifications) return false;
  if (!params.lastReminderSentAt) return true;

  const cooldownStart = new Date(params.now.getTime() - COOLDOWN_HOURS * MS_PER_HOUR);
  return params.lastReminderSentAt < cooldownStart;
}

/**
 * Daily digest reminder for due flashcards (issue #22 AC: "E-mail de lembrete
 * enviado para cards vencidos"). One email per user, not one per card.
 * Exported standalone (instead of only as the inline BullMQ processor) so
 * tests can exercise the real grouping/cooldown/escaping/send logic without
 * mounting a queue.
 */
export async function processFlashcardReminderJob(): Promise<void> {
  const now = new Date();

  const dueCards = await prisma.flashcard.findMany({
    where: { suspended: false, dueAt: { lte: now } },
    select: { userId: true, front: true },
  });

  if (dueCards.length === 0) {
    logger.info("flashcard-reminder: no due cards, skipping");
    return;
  }

  const dbTemplate = await prisma.adminEmailTemplate.findUnique({ where: { code: TEMPLATE_CODE } });
  if (dbTemplate && !dbTemplate.active) {
    logger.info("flashcard-reminder: template disabled by admin, skipping");
    return;
  }
  const template = dbTemplate ?? buildFallbackTemplate();

  const frontsByUser = groupFrontsByUser(dueCards);

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

    if (
      !shouldSendReminder({
        emailNotifications: user.emailNotifications,
        lastReminderSentAt: recentEvent?.sentAt ?? null,
        now,
      })
    ) {
      skipped++;
      continue;
    }

    const count = fronts.length;
    const plural = count > 1 ? "s" : "";
    const previewItems = fronts
      .slice(0, PREVIEW_LIMIT)
      .map((front) => `<li style="margin-bottom:6px;">${escapeHtml(front)}</li>`)
      .join("");
    const remainder = count - PREVIEW_LIMIT;
    const cardList = `
      <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#0f172a;">Voce tem <strong>${count}</strong> flashcard${plural} aguardando revisao:</p>
      <ul style="margin:0 0 14px 18px;padding:0;font-size:14px;line-height:1.5;color:#0f172a;">${previewItems}</ul>
      ${remainder > 0 ? `<p style="margin:0 0 14px 0;font-size:13px;color:#475569;">...e mais ${remainder}.</p>` : ""}
    `;

    const vars = {
      name: escapeHtml(user.name ?? "aluno"),
      count: String(count),
      plural,
      card_list: cardList,
      app_url: config.app.url,
      logo_url: STATIC_LOGO_URL,
    };
    const { html, subject } = buildEmailContent(template.html, template.subject, vars);

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
}

export function createFlashcardReminderWorker(): Worker<FlashcardReminderJobData> {
  return new Worker<FlashcardReminderJobData>("flashcard-reminder", processFlashcardReminderJob, {
    connection,
    concurrency: 1,
  });
}
