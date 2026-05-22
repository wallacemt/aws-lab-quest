import { Worker } from "bullmq";
import { redis, EmailSendJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { sendEmail, buildEmailContent } from "../services/email.js";
import { logger } from "../shared/logger.js";

const STATIC_LOGO_URL =
  "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/simulado-artwork/android-chrome-512x512.png";

export function createEmailSendWorker(): Worker {
  return new Worker<EmailSendJobData>(
    "email-send",
    async (job) => {
      const { templateId, targetMode, userId } = job.data;

      const template = await prisma.adminEmailTemplate.findUnique({
        where: { id: templateId },
        select: { subject: true, html: true, name: true },
      });

      if (!template) {
        logger.warn({ templateId }, "email-send: template not found, skipping");
        return;
      }

      const users =
        targetMode === "single-user"
          ? await prisma.user.findMany({
              where: { id: userId, active: true },
              select: { email: true, name: true },
            })
          : await prisma.user.findMany({
              where: { accessStatus: "approved", active: true },
              select: { email: true, name: true },
            });

      const appUrl = config.app.url;
      const logoUrl = STATIC_LOGO_URL;

      let sent = 0;
      let failed = 0;

      for (const user of users) {
        const vars = {
          name: user.name ?? "Aluno",
          app_url: appUrl,
          logo_url: logoUrl,
        };
        const { html, subject } = buildEmailContent(template.html, template.subject, vars);

        try {
          await sendEmail({ to: user.email, subject, html });
          sent++;
        } catch (err) {
          logger.warn({ err, email: user.email }, "email-send: failed to send to user");
          failed++;
        }
      }

      logger.info(
        { templateId, templateName: template.name, targetMode, sent, failed },
        "email-send: done"
      );
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );
}
