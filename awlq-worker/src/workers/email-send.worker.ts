import { Worker } from "bullmq";
import { connection, EmailSendJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { sendEmail, buildEmailContent } from "../services/email.js";
import { logger } from "../shared/logger.js";
import { generateUnsubscribeToken } from "../shared/unsubscribe-token.js";

const STATIC_LOGO_URL =
  "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/simulado-artwork/android-chrome-512x512.png";

export function createEmailSendWorker(): Worker {
  return new Worker<EmailSendJobData>(
    "email-send",
    async (job) => {
      const { templateId, targetMode, userId, userIds } = job.data;

      // Either a saved template or a raw subject+html pair written directly in the
      // admin "Escrever" tab — the two are mutually exclusive alternatives.
      let subjectSource: string;
      let htmlSource: string;
      let templateName = "raw";

      if (templateId) {
        const template = await prisma.adminEmailTemplate.findUnique({
          where: { id: templateId },
          select: { subject: true, html: true, name: true },
        });

        if (!template) {
          logger.warn({ templateId }, "email-send: template not found, skipping");
          return;
        }

        subjectSource = template.subject;
        htmlSource = template.html;
        templateName = template.name;
      } else if (job.data.subject && job.data.html) {
        subjectSource = job.data.subject;
        htmlSource = job.data.html;
      } else {
        logger.warn({ templateId, targetMode }, "email-send: neither templateId nor subject+html provided, skipping");
        return;
      }

      // For broadcast-style sends (all-users / admin-picked specific-users), only
      // include users who have not opted out. single-user bypasses opt-out —
      // reserved for essential transactional sends (password reset, etc).
      const users =
        targetMode === "single-user"
          ? await prisma.user.findMany({
              where: { id: userId, active: true },
              select: { id: true, email: true, name: true, emailNotifications: true },
            })
          : targetMode === "specific-users"
            ? await prisma.user.findMany({
                where: { id: { in: userIds ?? [] }, active: true, emailNotifications: true },
                select: { id: true, email: true, name: true, emailNotifications: true },
              })
            : await prisma.user.findMany({
                where: { accessStatus: "approved", active: true, emailNotifications: true },
                select: { id: true, email: true, name: true, emailNotifications: true },
              });

      const appUrl = config.app.url;
      const logoUrl = STATIC_LOGO_URL;

      let sent = 0;
      let failed = 0;

      for (const user of users) {
        // Single-user sends (e.g. transactional) bypass opt-out — they are
        // essential system emails (password reset, account notices). Broadcast
        // sends are always opt-out filtered by the query above, but we do a
        // redundant check here as a safety net.
        if (targetMode !== "single-user" && user.emailNotifications === false) {
          continue;
        }

        const unsubscribeToken = generateUnsubscribeToken(user.id);
        const unsubscribeUrl = `${appUrl}/api/user/unsubscribe?token=${unsubscribeToken}`;

        const unsubscribeFooter =
          targetMode !== "single-user"
            ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;text-align:center;">` +
              `<p style="font-size:11px;color:#64748b;margin:0;">` +
              `Para nao receber mais e-mails de engajamento, ` +
              `<a href="${unsubscribeUrl}" style="color:#0ea5e9;">clique aqui para se descadastrar</a>.` +
              `</p></div>`
            : "";

        const vars = {
          name: user.name ?? "Aluno",
          app_url: appUrl,
          logo_url: logoUrl,
          unsubscribe_url: unsubscribeUrl,
        };
        const { html: renderedHtml, subject } = buildEmailContent(htmlSource, subjectSource, vars);
        const html = renderedHtml + unsubscribeFooter;

        try {
          await sendEmail({ to: user.email, subject, html });
          sent++;
        } catch (err) {
          logger.warn({ err, email: user.email }, "email-send: failed to send to user");
          failed++;
        }
      }

      logger.info(
        { templateId, templateName, targetMode, sent, failed },
        "email-send: done"
      );
    },
    {
      connection,
      concurrency: 1,
    }
  );
}
