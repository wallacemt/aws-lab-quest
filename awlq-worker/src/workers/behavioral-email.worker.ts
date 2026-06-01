import { Worker } from "bullmq";
import { redis, BehavioralEmailJobData } from "../queues/index.js";
import { prisma } from "../prisma.js";
import { logger } from "../shared/logger.js";
import { analyzeAndScheduleBehavioralEmails } from "../services/behavior-analyzer.js";
import { generatePersonalizedEmail } from "../services/personalized-email-generator.js";
import { sendEmail } from "../services/email.js";

const MS_PER_DAY = 86_400_000;

export function createBehavioralEmailWorker(): Worker<BehavioralEmailJobData> {
  return new Worker<BehavioralEmailJobData>(
    "behavioral-email",
    async (job) => {
      const { mode } = job.data;

      if (mode === "analyze") {
        const result = await analyzeAndScheduleBehavioralEmails();
        logger.info(result, "behavioral-email: analysis complete");
        return;
      }

      // mode === "send"
      const { userId, triggerCode } = job.data;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailNotifications: true,
          profile: {
            select: {
              certificationPreset: { select: { code: true } },
            },
          },
        },
      });

      if (!user) {
        logger.warn({ userId }, "behavioral-email: user not found, skipping");
        return;
      }

      if (!user.emailNotifications) {
        logger.info({ userId }, "behavioral-email: user opted out of emails, skipping");
        return;
      }

      // Double-check cooldown to avoid race conditions
      const threeDaysAgo = new Date(Date.now() - 3 * MS_PER_DAY);
      const recentEvent = await prisma.userEmailEvent.findFirst({
        where: { userId, sentAt: { gte: threeDaysAgo } },
      });

      if (recentEvent) {
        logger.info({ userId, triggerCode }, "behavioral-email: cooldown active, skipping");
        return;
      }

      // Fetch context for the email
      const recentSessions = await prisma.studySessionHistory.findMany({
        where: { userId, completedAt: { gte: new Date(Date.now() - 7 * MS_PER_DAY) } },
        orderBy: { completedAt: "desc" },
        take: 10,
        select: { scorePercent: true, completedAt: true },
      });

      const recentScoreAvg =
        recentSessions.length > 0
          ? Math.round(recentSessions.reduce((sum, s) => sum + s.scorePercent, 0) / recentSessions.length)
          : undefined;

      const daysSinceLastSession =
        recentSessions.length > 0
          ? Math.floor((Date.now() - recentSessions[0]!.completedAt.getTime()) / MS_PER_DAY)
          : undefined;

      const profile = await prisma.userBehaviorProfile.findUnique({
        where: { userId },
        select: { streakDays: true },
      });

      const { subject, htmlBody } = await generatePersonalizedEmail({
        name: user.name,
        triggerCode,
        daysSinceLastSession,
        streakDays: profile?.streakDays,
        recentScoreAvg,
        certificationCode: user.profile?.certificationPreset?.code,
        sessionCountLast7Days: recentSessions.length,
      });

      await sendEmail({ to: user.email, subject, html: htmlBody });

      // Record the event and update behavior profile
      await Promise.all([
        prisma.userEmailEvent.create({
          data: { userId, triggerCode, subject, sentAt: new Date() },
        }),
        prisma.userBehaviorProfile.upsert({
          where: { userId },
          create: { userId, lastEmailSentAt: new Date() },
          update: { lastEmailSentAt: new Date() },
        }),
      ]);

      logger.info({ userId, triggerCode, subject }, "behavioral-email: email sent successfully");
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );
}
