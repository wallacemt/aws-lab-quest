import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AWS_CERTIFICATION_PRESETS } from "@/lib/certification-presets";
import { createClient } from "@supabase/supabase-js";
import { SeedAwsService } from "@/types/seeds";
import { ACHIEVEMENT_DEFS } from "@/lib/achievement-catalog";
import { LEVEL_DEFS, SERVICE_FALLBACK } from "@/lib/utils";

const DEFAULT_XP_WEIGHTS = [
  { activityType: "LAB", topic: "*", difficulty: "*", multiplier: 1.2, bonusXp: 0 },
  { activityType: "KC", topic: "*", difficulty: "easy", multiplier: 0.8, bonusXp: 0 },
  { activityType: "KC", topic: "*", difficulty: "medium", multiplier: 1, bonusXp: 0 },
  { activityType: "KC", topic: "*", difficulty: "hard", multiplier: 1.25, bonusXp: 0 },
  { activityType: "SIMULADO", topic: "*", difficulty: "easy", multiplier: 1, bonusXp: 0 },
  { activityType: "SIMULADO", topic: "*", difficulty: "medium", multiplier: 1.2, bonusXp: 0 },
  { activityType: "SIMULADO", topic: "*", difficulty: "hard", multiplier: 1.4, bonusXp: 0 },
  { activityType: "KC", topic: "EC2", difficulty: "*", multiplier: 1.4, bonusXp: 20 },
  { activityType: "KC", topic: "IAM", difficulty: "*", multiplier: 1.15, bonusXp: 10 },
  { activityType: "KC", topic: "VPC", difficulty: "*", multiplier: 1.25, bonusXp: 15 },
  // Phase 1: Retention spine activity types
  { activityType: "flashcard",     topic: "*", difficulty: "*", multiplier: 0.5, bonusXp: 5 },
  { activityType: "sprint",        topic: "*", difficulty: "*", multiplier: 1.0, bonusXp: 10 },
  { activityType: "daily_review",  topic: "*", difficulty: "*", multiplier: 0.8, bonusXp: 15 },
] as const;

async function generateBadgeImage(prompt: string): Promise<{ data: Buffer; mimeType: string }> {
  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 9999);
  const url = `https://gen.pollinations.ai/image/${encoded}?model=flux&width=512&height=512&seed=${seed}&key=${process.env.POLLINATIONS_API_KEY}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const mimeType = contentType.split(";")[0].trim();
      return { data: Buffer.from(arrayBuffer), mimeType };
    }

    const errText = await response.text();
    if (attempt === 3) {
      throw new Error(`Pollinations API error (${response.status}) after 3 attempts: ${errText}`);
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error("unreachable");
}

function normalizeServiceCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
}

const SERVICE_NAME_OVERRIDES: Record<string, string> = {
  ec2: "Amazon EC2",
  s3: "Amazon S3",
  iam: "AWS Identity and Access Management (IAM)",
  rds: "Amazon RDS",
  vpc: "Amazon VPC",
  lambda: "AWS Lambda",
  dynamodb: "Amazon DynamoDB",
  cloudwatch: "Amazon CloudWatch",
  route53: "Amazon Route 53",
  cloudfront: "Amazon CloudFront",
  sqs: "Amazon SQS",
  sns: "Amazon SNS",
  ecs: "Amazon ECS",
  eks: "Amazon EKS",
  kms: "AWS Key Management Service (KMS)",
  secretsmanager: "AWS Secrets Manager",
  apigateway: "Amazon API Gateway",
  cloudformation: "AWS CloudFormation",
  eventbridge: "Amazon EventBridge",
  stepfunctions: "AWS Step Functions",
  pricing: "AWS Price List API",
  "api.pricing": "AWS Price List API",
};

function humanizeServiceName(raw: string): string {
  const normalizedRaw = raw.trim();
  const lowered = normalizedRaw.toLowerCase();

  if (SERVICE_NAME_OVERRIDES[lowered]) {
    return SERVICE_NAME_OVERRIDES[lowered];
  }

  const title = normalizedRaw
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (/^[A-Z0-9]{2,}$/.test(token)) {
        return token;
      }
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");

  if (title.startsWith("Amazon ") || title.startsWith("AWS ")) {
    return title;
  }

  return `AWS ${title}`;
}

async function fetchAwsServicesFromSdkSource(): Promise<SeedAwsService[]> {
  const sourceUrl = "https://raw.githubusercontent.com/aws/aws-sdk-go/main/models/endpoints/endpoints.json";

  try {
    const response = await fetch(sourceUrl, { headers: { "User-Agent": "aws-lab-quest-seed" } });
    if (!response.ok) {
      throw new Error(`Failed to fetch SDK endpoint metadata: ${response.status}`);
    }

    const payload = (await response.json()) as {
      partitions?: Array<{
        services?: Record<string, unknown>;
      }>;
    };

    const serviceKeys = new Set<string>();
    for (const partition of payload.partitions ?? []) {
      for (const key of Object.keys(partition.services ?? {})) {
        serviceKeys.add(key);
      }
    }

    const normalized = Array.from(serviceKeys)
      .map((serviceKey) => {
        const code = normalizeServiceCode(serviceKey);
        return {
          code,
          name: humanizeServiceName(serviceKey),
          description: `Servico AWS sincronizado a partir do metadata do SDK v3 (${serviceKey}).`,
        } satisfies SeedAwsService;
      })
      .filter((item) => item.code.length > 1);

    if (normalized.length === 0) {
      throw new Error("SDK metadata did not contain service keys");
    }

    const deduped = new Map<string, SeedAwsService>();
    for (const item of [...SERVICE_FALLBACK, ...normalized]) {
      if (!deduped.has(item.code)) {
        deduped.set(item.code, item);
      }
    }

    return Array.from(deduped.values());
  } catch (error) {
    console.warn("Could not fetch AWS services from SDK metadata. Falling back to curated list.", error);
    return SERVICE_FALLBACK;
  }
}

async function seedCertifications() {
  console.log("Seeding certification presets...");

  await prisma.$transaction(
    AWS_CERTIFICATION_PRESETS.map((preset) =>
      prisma.certificationPreset.upsert({
        where: { code: preset.code },
        create: {
          code: preset.code,
          name: preset.name,
          description: preset.description,
          displayOrder: preset.displayOrder,
          examMinutes: preset.examMinutes ?? 90,
          active: true,
        },
        update: {
          name: preset.name,
          description: preset.description,
          displayOrder: preset.displayOrder,
          examMinutes: preset.examMinutes ?? 90,
          active: true,
        },
      }),
    ),
  );
}

async function seedAwsServicesAndQuestions() {
  console.log("Seeding AWS services and question bank...");

  const services = await fetchAwsServicesFromSdkSource();

  for (const service of services) {
    await prisma.awsService.upsert({
      where: { code: service.code },
      create: {
        code: service.code,
        name: service.name,
        description: service.description,
        active: true,
      },
      update: {
        name: service.name,
        description: service.description,
        active: true,
      },
    });
  }
}

async function seedBadgesIfConfigured() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("Skipping badge image seed (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not provided).");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Seeding level badges...");

  for (const def of LEVEL_DEFS) {
    const existing = await prisma.levelBadge.findUnique({ where: { level: def.level } });
    if (existing) {
      return;
    }

    const { data: imageBuffer, mimeType } = await generateBadgeImage(def.prompt);
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `badges/level-${def.level}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("aws-lab-quest")
      .upload(path, imageBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      throw new Error(`Upload failed for level ${def.level}: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("aws-lab-quest").getPublicUrl(path);

    await prisma.levelBadge.create({
      data: {
        level: def.level,
        name: def.name,
        imageUrl: publicUrlData.publicUrl,
        supabasePath: path,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function seedAchievementsIfConfigured() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("Seeding achievements without generated images (SUPABASE not configured).");

    for (const def of ACHIEVEMENT_DEFS) {
      const existing = await prisma.achievement.findUnique({ where: { code: def.code } });
      if (existing) {
        return;
      }
      await prisma.achievement.upsert({
        where: { code: def.code },
        create: {
          code: def.code,
          name: def.name,
          description: def.description,
          rarity: def.rarity,
          generationPrompt: def.prompt,
          displayOrder: def.displayOrder,
          active: true,
        },
        update: {
          name: def.name,
          description: def.description,
          rarity: def.rarity,
          generationPrompt: def.prompt,
          displayOrder: def.displayOrder,
          active: true,
        },
      });
    }

    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Seeding achievements and generated badges...");

  for (const def of ACHIEVEMENT_DEFS) {
    const existing = await prisma.achievement.findUnique({ where: { code: def.code } });

    let imageUrl = existing?.imageUrl ?? null;
    let supabasePath = existing?.supabasePath ?? null;

    if (!imageUrl || !supabasePath) {
      const { data: imageBuffer, mimeType } = await generateBadgeImage(def.prompt);
      const ext = mimeType.includes("png") ? "png" : "jpg";
      const path = `achievements/${def.code}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("aws-lab-quest")
        .upload(path, imageBuffer, { contentType: mimeType, upsert: true });

      if (uploadError) {
        throw new Error(`Upload failed for achievement ${def.code}: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from("aws-lab-quest").getPublicUrl(path);
      imageUrl = publicUrlData.publicUrl;
      supabasePath = path;

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    await prisma.achievement.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        description: def.description,
        rarity: def.rarity,
        generationPrompt: def.prompt,
        displayOrder: def.displayOrder,
        imageUrl,
        supabasePath,
        active: true,
      },
      update: {
        name: def.name,
        description: def.description,
        rarity: def.rarity,
        generationPrompt: def.prompt,
        displayOrder: def.displayOrder,
        imageUrl,
        supabasePath,
        active: true,
      },
    });
  }
}

async function seedAdminIfConfigured() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminName = process.env.ADMIN_NAME?.trim() || "Admin";

  if (!adminEmail || !adminPassword) {
    console.log("Skipping admin seed (ADMIN_EMAIL / ADMIN_PASSWORD not provided).");
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingUser) {
    await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: adminName,
      },
    });
  }

  await prisma.user.update({
    where: { email: adminEmail },
    data: {
      role: "admin",
      active: true,
      accessStatus: "approved",
      accessDecisionAt: new Date(),
      accessDecisionReason: "Conta administrativa liberada via seed.",
    },
  });

  console.log(`Admin user ready: ${adminEmail}`);
}

async function seedXpWeights() {
  console.log("Seeding XP weight configs...");

  for (const config of DEFAULT_XP_WEIGHTS) {
    await prisma.xpWeightConfig.upsert({
      where: {
        activityType_topic_difficulty: {
          activityType: config.activityType,
          topic: config.topic,
          difficulty: config.difficulty,
        },
      },
      create: {
        activityType: config.activityType,
        topic: config.topic,
        difficulty: config.difficulty,
        multiplier: config.multiplier,
        bonusXp: config.bonusXp,
        active: true,
      },
      update: {
        multiplier: config.multiplier,
        bonusXp: config.bonusXp,
        active: true,
      },
    });
  }
}

// ─── Task 7a: Arena Bosses ────────────────────────────────────────────────────

const ARENA_BOSSES = [
  { name: "Guardião EC2", code: "ec2-boss", themeService: "EC2", maxHp: 1000, damagePerCorrect: 50, active: true },
  { name: "Oráculo IAM",  code: "iam-boss", themeService: "IAM", maxHp: 800,  damagePerCorrect: 40, active: true },
  { name: "Arquiteto S3", code: "s3-boss",  themeService: "S3",  maxHp: 600,  damagePerCorrect: 30, active: true },
] as const;

async function seedArenaBosses() {
  console.log("Seeding arena bosses...");
  for (const boss of ARENA_BOSSES) {
    await prisma.boss.upsert({
      where: { code: boss.code },
      create: boss,
      update: {},
    });
  }
}

// ─── Task 7b: News Sources ────────────────────────────────────────────────────

const NEWS_SOURCES = [
  { name: "AWS Blog",       feedUrl: "https://aws.amazon.com/blogs/aws/feed/",      category: "cloud",   active: true },
  { name: "AWS Security",   feedUrl: "https://aws.amazon.com/blogs/security/feed/", category: "security", active: true },
  { name: "dev.to AWS Tag", feedUrl: "https://dev.to/feed/tag/aws",                 category: "cloud",   active: true },
] as const;

async function seedNewsSources() {
  console.log("Seeding news sources...");
  for (const source of NEWS_SOURCES) {
    await prisma.newsSource.upsert({
      where: { feedUrl: source.feedUrl },
      create: source,
      update: {},
    });
  }
}

// ─── Task 7c: Quest Chains ────────────────────────────────────────────────────

type QuestChainSeed = {
  name: string;
  description: string;
  active: boolean;
  displayOrder: number;
  stages: { title: string; position: number; awsServiceCode: string }[];
};

const QUEST_CHAINS: QuestChainSeed[] = [
  {
    name: "Fundamentos IAM",
    description: "Do zero ao herói em Identity and Access Management da AWS.",
    active: true,
    displayOrder: 1,
    stages: [
      { title: "Usuários e Grupos",       position: 1, awsServiceCode: "IAM" },
      { title: "Políticas e Permissões",  position: 2, awsServiceCode: "IAM" },
      { title: "Roles e Trust Policies",  position: 3, awsServiceCode: "IAM" },
      { title: "MFA e Boas Práticas",     position: 4, awsServiceCode: "IAM" },
    ],
  },
  {
    name: "S3 do Básico ao Avançado",
    description: "Armazenamento de objetos: de buckets simples a replicação cross-region.",
    active: true,
    displayOrder: 2,
    stages: [
      { title: "Criando e configurando Buckets",    position: 1, awsServiceCode: "S3" },
      { title: "Versionamento e Ciclo de Vida",     position: 2, awsServiceCode: "S3" },
      { title: "Bucket Policies e ACLs",            position: 3, awsServiceCode: "S3" },
      { title: "Replicação e Transfer Acceleration", position: 4, awsServiceCode: "S3" },
    ],
  },
];

async function seedQuestChains() {
  console.log("Seeding quest chains...");
  for (const chainData of QUEST_CHAINS) {
    // QuestChain has no @@unique on name — use findFirst + create pattern.
    let chain = await prisma.questChain.findFirst({ where: { name: chainData.name } });
    if (!chain) {
      chain = await prisma.questChain.create({
        data: {
          name: chainData.name,
          description: chainData.description,
          active: chainData.active,
          displayOrder: chainData.displayOrder,
        },
      });
    }

    for (const stage of chainData.stages) {
      await prisma.questChainStage.upsert({
        where: { chainId_position: { chainId: chain.id, position: stage.position } },
        create: {
          chainId: chain.id,
          title: stage.title,
          position: stage.position,
          awsServiceId: stage.awsServiceCode,
        },
        update: {},
      });
    }
  }
}

// ─── Task 7d: Changelog ───────────────────────────────────────────────────────

const CHANGELOG_ENTRIES = [
  { category: "novo", text: "Modo Lab com geração de quests por IA" },
  { category: "novo", text: "Modo KC com Knowledge Check por serviço AWS" },
  { category: "novo", text: "Simulado com timer de 90 minutos" },
  { category: "novo", text: "Arena de Batalha com bosses por serviço AWS" },
  { category: "novo", text: "Flashcards com revisão espacada SM-2" },
  { category: "novo", text: "Sprint Mode para sessões rápidas" },
  { category: "novo", text: "Trilhas de aprendizagem sequenciais" },
  { category: "novo", text: "Mentor IA com recomendações personalizadas" },
  { category: "novo", text: "Biblioteca de conteúdo com PDFs e artigos" },
  { category: "novo", text: "Jornada do Herói com boss final de certificação" },
] as const;

// Negative githubId is used as a synthetic seed-only identifier that won't
// conflict with real GitHub release integer ids (always positive).
const SEED_GITHUB_ID = -1;

async function seedChangelog() {
  console.log("Seeding changelog...");

  const release = await prisma.changelogRelease.upsert({
    where: { githubId: SEED_GITHUB_ID },
    create: {
      githubId: SEED_GITHUB_ID,
      tagName: "v1.0.0",
      name: "Lançamento Inicial — AWS Lab Quest",
      published: true,
      highlight: true,
      releasedAt: new Date("2026-01-01"),
      adminSummary:
        "Primeira versão pública da plataforma com Lab, KC, Simulado, Arena, Flashcards, Trilhas e Mentor IA.",
    },
    update: {},
  });

  // Only create entries when none exist for this release (idempotent).
  const existingCount = await prisma.changelogEntry.count({ where: { releaseId: release.id } });
  if (existingCount === 0) {
    await prisma.changelogEntry.createMany({
      data: CHANGELOG_ENTRIES.map((entry) => ({ ...entry, releaseId: release.id })),
    });
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  await seedAdminIfConfigured();
  await seedCertifications();
  await seedAwsServicesAndQuestions();
  await seedXpWeights();
  await seedBadgesIfConfigured();
  await seedAchievementsIfConfigured();
  await seedArenaBosses();
  await seedNewsSources();
  await seedQuestChains();
  await seedChangelog();
  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
