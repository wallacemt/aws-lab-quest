/**
 * seed-mock-user.ts
 *
 * Creates a mock student user ("Ana Estudante") with realistic study history:
 * - Multiple study sessions with poor performance in weak areas (S3, Lambda, IAM, VPC)
 * - Some sessions with acceptable performance to make the data realistic
 * - Lab quest completions and trail progress
 * - Achievements earned based on study activity
 *
 * Run: cd aws-lab-quest/awlq-app && npx tsx prisma/seed-mock-user.ts
 */

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const MOCK_EMAIL = "mock@awlq.dev";
const MOCK_PASSWORD = "MockUser@123";
const MOCK_NAME = "Ana Estudante";

// Session snapshots simulate 10-question sessions
function makeAnswersSnapshot(
  total: number,
  correct: number,
): { questionId: string; correct: boolean }[] {
  return Array.from({ length: total }, (_, i) => ({
    questionId: `mock-q-${i}`,
    correct: i < correct,
  }));
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log("🎮 Seeding mock user...");

  // ─── 1. Create user via Better Auth ─────────────────────────────────────────
  const existingUser = await prisma.user.findUnique({ where: { email: MOCK_EMAIL } });

  if (!existingUser) {
    await auth.api.signUpEmail({
      body: { email: MOCK_EMAIL, password: MOCK_PASSWORD, name: MOCK_NAME },
    });
    console.log(`  ✓ User created: ${MOCK_EMAIL}`);
  } else {
    console.log(`  → User already exists: ${MOCK_EMAIL}`);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { email: MOCK_EMAIL } });

  // Approve the user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      accessStatus: "approved",
      accessDecisionAt: new Date(),
      accessDecisionReason: "Mock user auto-approved by seed",
    },
  });

  // ─── 2. Update profile with SAA-C03 cert and theme ──────────────────────────
  const saaPreset = await prisma.certificationPreset.findFirst({ where: { code: "SAA-C03" } });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      certification: "SAA-C03",
      certificationPresetId: saaPreset?.id,
      favoriteTheme: "videogames",
    },
    update: {
      certification: "SAA-C03",
      certificationPresetId: saaPreset?.id,
      favoriteTheme: "videogames",
    },
  });

  console.log("  ✓ UserProfile upserted");

  // ─── 3. Study sessions — weak areas (correctRate < 60%) ─────────────────────
  // These trigger feedback-analysis.worker to queue question generation
  const weakSessions: Parameters<typeof prisma.studySessionHistory.create>[0]["data"][] = [
    // S3 — consistently poor (4/10 = 40%)
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon S3",
      certificationCode: "SAA-C03",
      gainedXp: 48,
      scorePercent: 40,
      correctAnswers: 4,
      totalQuestions: 10,
      durationSeconds: 480,
      answersSnapshot: makeAnswersSnapshot(10, 4),
      completedAt: daysAgo(14),
    },
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon S3",
      certificationCode: "SAA-C03",
      gainedXp: 50,
      scorePercent: 50,
      correctAnswers: 5,
      totalQuestions: 10,
      durationSeconds: 510,
      answersSnapshot: makeAnswersSnapshot(10, 5),
      completedAt: daysAgo(10),
    },
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon S3",
      certificationCode: "SAA-C03",
      gainedXp: 45,
      scorePercent: 45,
      correctAnswers: 4,
      totalQuestions: 10,
      durationSeconds: 495,
      answersSnapshot: makeAnswersSnapshot(10, 4),
      completedAt: daysAgo(5),
    },
    // AWS Lambda — poor (5/10 = 50%)
    {
      userId: user.id,
      sessionType: "KC",
      title: "AWS Lambda",
      certificationCode: "SAA-C03",
      gainedXp: 50,
      scorePercent: 50,
      correctAnswers: 5,
      totalQuestions: 10,
      durationSeconds: 540,
      answersSnapshot: makeAnswersSnapshot(10, 5),
      completedAt: daysAgo(13),
    },
    {
      userId: user.id,
      sessionType: "KC",
      title: "AWS Lambda",
      certificationCode: "SAA-C03",
      gainedXp: 40,
      scorePercent: 40,
      correctAnswers: 4,
      totalQuestions: 10,
      durationSeconds: 460,
      answersSnapshot: makeAnswersSnapshot(10, 4),
      completedAt: daysAgo(7),
    },
    // IAM — very poor (3/10 = 30%)
    {
      userId: user.id,
      sessionType: "KC",
      title: "AWS IAM",
      certificationCode: "SAA-C03",
      gainedXp: 36,
      scorePercent: 30,
      correctAnswers: 3,
      totalQuestions: 10,
      durationSeconds: 520,
      answersSnapshot: makeAnswersSnapshot(10, 3),
      completedAt: daysAgo(12),
    },
    {
      userId: user.id,
      sessionType: "KC",
      title: "AWS IAM",
      certificationCode: "SAA-C03",
      gainedXp: 45,
      scorePercent: 45,
      correctAnswers: 4,
      totalQuestions: 10,
      durationSeconds: 530,
      answersSnapshot: makeAnswersSnapshot(10, 4),
      completedAt: daysAgo(6),
    },
    // VPC — poor (4-5/10)
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon VPC",
      certificationCode: "SAA-C03",
      gainedXp: 50,
      scorePercent: 50,
      correctAnswers: 5,
      totalQuestions: 10,
      durationSeconds: 570,
      answersSnapshot: makeAnswersSnapshot(10, 5),
      completedAt: daysAgo(11),
    },
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon VPC",
      certificationCode: "SAA-C03",
      gainedXp: 40,
      scorePercent: 40,
      correctAnswers: 4,
      totalQuestions: 10,
      durationSeconds: 490,
      answersSnapshot: makeAnswersSnapshot(10, 4),
      completedAt: daysAgo(4),
    },
    // RDS — borderline (6/10 = 60%)
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon RDS",
      certificationCode: "SAA-C03",
      gainedXp: 72,
      scorePercent: 60,
      correctAnswers: 6,
      totalQuestions: 10,
      durationSeconds: 430,
      answersSnapshot: makeAnswersSnapshot(10, 6),
      completedAt: daysAgo(9),
    },
  ];

  // Better sessions on other services
  const goodSessions: Parameters<typeof prisma.studySessionHistory.create>[0]["data"][] = [
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon EC2",
      certificationCode: "SAA-C03",
      gainedXp: 90,
      scorePercent: 80,
      correctAnswers: 8,
      totalQuestions: 10,
      durationSeconds: 380,
      answersSnapshot: makeAnswersSnapshot(10, 8),
      completedAt: daysAgo(20),
    },
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon CloudFront",
      certificationCode: "SAA-C03",
      gainedXp: 80,
      scorePercent: 70,
      correctAnswers: 7,
      totalQuestions: 10,
      durationSeconds: 400,
      answersSnapshot: makeAnswersSnapshot(10, 7),
      completedAt: daysAgo(18),
    },
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon SQS",
      certificationCode: "SAA-C03",
      gainedXp: 88,
      scorePercent: 77,
      correctAnswers: 7,
      totalQuestions: 10,
      durationSeconds: 410,
      answersSnapshot: makeAnswersSnapshot(10, 7),
      completedAt: daysAgo(16),
    },
    {
      userId: user.id,
      sessionType: "KC",
      title: "Amazon SNS",
      certificationCode: "SAA-C03",
      gainedXp: 90,
      scorePercent: 80,
      correctAnswers: 8,
      totalQuestions: 10,
      durationSeconds: 360,
      answersSnapshot: makeAnswersSnapshot(10, 8),
      completedAt: daysAgo(15),
    },
    // SIMULADO with poor overall result
    {
      userId: user.id,
      sessionType: "SIMULADO",
      title: "Simulado SAA-C03 #1",
      certificationCode: "SAA-C03",
      gainedXp: 480,
      scorePercent: 48,
      correctAnswers: 32,
      totalQuestions: 65,
      durationSeconds: 3800,
      answersSnapshot: makeAnswersSnapshot(65, 32),
      completedAt: daysAgo(8),
    },
    // SIMULADO slightly better but still failing
    {
      userId: user.id,
      sessionType: "SIMULADO",
      title: "Simulado SAA-C03 #2",
      certificationCode: "SAA-C03",
      gainedXp: 540,
      scorePercent: 54,
      correctAnswers: 35,
      totalQuestions: 65,
      durationSeconds: 4200,
      answersSnapshot: makeAnswersSnapshot(65, 35),
      completedAt: daysAgo(3),
    },
  ];

  const allSessions = [...weakSessions, ...goodSessions];

  // Use createMany skipping duplicates is not straightforward; insert individually
  for (const session of allSessions) {
    await prisma.studySessionHistory.create({ data: session });
  }
  console.log(`  ✓ ${allSessions.length} study sessions created`);

  // ─── 4. Lab quest history ────────────────────────────────────────────────────
  const questHistory = [
    {
      userId: user.id,
      title: "Quest: Armazenamento com S3",
      theme: "AWS Storage Fundamentals",
      xp: 120,
      tasksCount: 4,
      certification: "SAA-C03",
      userName: MOCK_NAME,
      taskSnapshot: [
        { id: "t1", title: "Criar bucket S3", completed: true, xp: 30 },
        { id: "t2", title: "Configurar política de acesso", completed: true, xp: 30 },
        { id: "t3", title: "Habilitar versionamento", completed: true, xp: 30 },
        { id: "t4", title: "Configurar lifecycle rules", completed: true, xp: 30 },
      ],
      completedAt: daysAgo(19),
    },
    {
      userId: user.id,
      title: "Quest: Computação sem Servidor",
      theme: "Serverless on AWS",
      xp: 100,
      tasksCount: 3,
      certification: "SAA-C03",
      userName: MOCK_NAME,
      taskSnapshot: [
        { id: "t1", title: "Criar função Lambda", completed: true, xp: 34 },
        { id: "t2", title: "Configurar trigger via API Gateway", completed: true, xp: 33 },
        { id: "t3", title: "Adicionar variáveis de ambiente", completed: true, xp: 33 },
      ],
      completedAt: daysAgo(17),
    },
    {
      userId: user.id,
      title: "Quest: Redes na AWS",
      theme: "Networking Foundations",
      xp: 90,
      tasksCount: 3,
      certification: "SAA-C03",
      userName: MOCK_NAME,
      taskSnapshot: [
        { id: "t1", title: "Criar VPC com sub-redes públicas e privadas", completed: true, xp: 30 },
        { id: "t2", title: "Configurar Internet Gateway", completed: true, xp: 30 },
        { id: "t3", title: "Criar Security Group", completed: true, xp: 30 },
      ],
      completedAt: daysAgo(13),
    },
  ];

  for (const quest of questHistory) {
    await prisma.questHistory.create({ data: quest });
  }
  console.log(`  ✓ ${questHistory.length} lab quest histories created`);

  // ─── 5. Trail progress ───────────────────────────────────────────────────────
  const firstChain = await prisma.questChain.findFirst({ where: { active: true } });
  if (firstChain) {
    const stages = await prisma.questChainStage.findMany({
      where: { chainId: firstChain.id },
      orderBy: { position: "asc" },
      take: 3,
    });

    for (const [i, stage] of stages.entries()) {
      await prisma.questChainProgress.upsert({
        where: { userId_stageId: { userId: user.id, stageId: stage.id } },
        create: {
          userId: user.id,
          stageId: stage.id,
          completed: true,
          completedAt: daysAgo(10 - i * 2),
        },
        update: {},
      });
    }
    console.log(`  ✓ Trail progress created for ${stages.length} stages`);
  } else {
    console.log("  ⚠ No active quest chain found — trail progress skipped");
  }

  // ─── 6. Achievements ─────────────────────────────────────────────────────────
  // "first_step" (first KC), "lab_master_10" (10+ sessions), "first_simulado"
  const achievementCodes = ["first_step", "lab_master_10", "first_simulado"];
  for (const code of achievementCodes) {
    const achievement = await prisma.achievement.findUnique({ where: { code } });
    if (!achievement) continue;

    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId: user.id, achievementId: achievement.id } },
      create: {
        userId: user.id,
        achievementId: achievement.id,
        progress: 100,
        metadata: { seeded: true },
      },
      update: {},
    });
  }
  console.log("  ✓ Achievements seeded");

  console.log(`\n✅ Mock user ready!`);
  console.log(`   Email:    ${MOCK_EMAIL}`);
  console.log(`   Password: ${MOCK_PASSWORD}`);
  console.log(`   Profile:  SAA-C03 | Level 2-3 (weak areas: S3, Lambda, IAM, VPC)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
