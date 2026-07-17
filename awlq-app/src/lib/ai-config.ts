import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type AiContext =
  // App contexts
  | "QUESTION_EXPLAIN"           // explain + mentor/ask + revisao gap chat
  | "SIMULADO_MESSAGE"           // simulado message + artwork
  | "LAB_GENERATION"             // jornada/lab
  | "TRAIL_QUESTION_GENERATION"  // trails questions (formerly QUESTION_GENERATION)
  | "ACHIEVEMENT_SUGGESTION"     // achievement suggestion + badge artwork prompt
  | "ARENA_BOSS_ARTWORK"         // arena boss artwork prompt
  // Worker contexts
  | "WORKER_KC_QUESTION"            // kc-question-builder
  | "WORKER_QUESTION_GENERATION"    // question-builder (PDF/blueprint)
  | "WORKER_QUALITY_REVIEW"         // quality-review.worker
  | "WORKER_BLUEPRINT_PARSER"       // blueprint-parser
  | "WORKER_EXAM_GUIDE"             // exam-guide-reviewer
  | "WORKER_EMAIL"                  // personalized-email-generator
  | "WORKER_TRAIL_ILLUSTRATION"     // trail-illustration.worker
  | "WORKER_TRAIL_REVIEW";          // trail-review.worker

export const AI_CONTEXTS: AiContext[] = [
  "QUESTION_EXPLAIN",
  "SIMULADO_MESSAGE",
  "LAB_GENERATION",
  "TRAIL_QUESTION_GENERATION",
  "ACHIEVEMENT_SUGGESTION",
  "ARENA_BOSS_ARTWORK",
  "WORKER_KC_QUESTION",
  "WORKER_QUESTION_GENERATION",
  "WORKER_QUALITY_REVIEW",
  "WORKER_BLUEPRINT_PARSER",
  "WORKER_EXAM_GUIDE",
  "WORKER_EMAIL",
  "WORKER_TRAIL_ILLUSTRATION",
  "WORKER_TRAIL_REVIEW",
];

// Kept for backward-compat references that might be compiled in; not used in the new flow.
export const AI_CONTEXT_LABELS: Record<AiContext, string> = {
  QUESTION_EXPLAIN:            "Explicacao de questoes",
  SIMULADO_MESSAGE:            "Mensagem motivacional",
  LAB_GENERATION:              "Geracao de labs",
  TRAIL_QUESTION_GENERATION:   "Questoes de trilhas",
  ACHIEVEMENT_SUGGESTION:      "Conquistas: sugestao e arte",
  ARENA_BOSS_ARTWORK:          "Arena: arte de bosses",
  WORKER_KC_QUESTION:          "KC: Geracao de questoes",
  WORKER_QUESTION_GENERATION:  "Geracao via PDF/Blueprint",
  WORKER_QUALITY_REVIEW:       "Revisao de qualidade",
  WORKER_BLUEPRINT_PARSER:     "Parser de blueprint",
  WORKER_EXAM_GUIDE:           "Revisor de guia de exame",
  WORKER_EMAIL:                "Emails personalizados",
  WORKER_TRAIL_ILLUSTRATION:   "Trilhas: ilustracao de estagio",
  WORKER_TRAIL_REVIEW:         "Trilhas: revisao de explicacao",
};

// ─── Encryption helpers (AES-256-GCM) ──────────────────────────────────────

type EncryptedBlob = { encryptedKey: string; iv: string; authTag: string };

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw) throw new Error("ENCRYPTION_KEY nao configurada");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptApiKey(plaintext: string): EncryptedBlob {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    encryptedKey: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptApiKey(stored: EncryptedBlob): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(stored.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(stored.authTag, "hex"));
  const buf = Buffer.from(stored.encryptedKey, "hex");
  return decipher.update(buf).toString("utf8") + decipher.final("utf8");
}

function maskKey(plain: string): string {
  if (plain.length <= 8) return "***";
  return `${plain.slice(0, 4)}${"*".repeat(Math.max(4, plain.length - 8))}${plain.slice(-4)}`;
}

// ─── Global OpenRouter key ──────────────────────────────────────────────────

const GLOBAL_KEY_ROW = "openrouter_api_key";

export async function saveOpenRouterKey(plainApiKey: string): Promise<void> {
  const blob = encryptApiKey(plainApiKey);
  await prisma.systemConfig.upsert({
    where: { key: GLOBAL_KEY_ROW },
    create: { key: GLOBAL_KEY_ROW, value: JSON.stringify(blob) },
    update: { value: JSON.stringify(blob) },
  });
}

export async function loadOpenRouterKey(): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key: GLOBAL_KEY_ROW } });
  if (!row) return null;
  try {
    return decryptApiKey(JSON.parse(row.value) as EncryptedBlob);
  } catch {
    return null;
  }
}

export async function maskedOpenRouterKey(): Promise<string | null> {
  const plain = await loadOpenRouterKey();
  return plain ? maskKey(plain) : null;
}

// ─── Per-context model config ───────────────────────────────────────────────

function configKey(context: AiContext): string {
  return `ai_config:${context}`;
}

/** Loads the resolved config for a context: model from DB (or env fallback) + global API key. */
export async function loadAiConfig(
  context: AiContext,
): Promise<{ model: string; apiKey: string } | null> {
  const [modelRow, apiKey] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: configKey(context) } }),
    loadOpenRouterKey(),
  ]);

  const resolvedKey = apiKey ?? process.env.OPENROUTER_API_KEY ?? null;
  if (!resolvedKey) return null;

  let model: string | undefined;
  if (modelRow) {
    try {
      const parsed = JSON.parse(modelRow.value) as { model?: string };
      model = parsed.model?.trim() || undefined;
    } catch {
      // fall through
    }
  }
  model ??= process.env.AI_MODEL ?? "openrouter/free";

  return { model, apiKey: resolvedKey };
}

/** Saves only the model for a context. The API key is global, not per-context. */
export async function saveAiConfig(context: AiContext, model: string): Promise<void> {
  const value = JSON.stringify({ model });
  await prisma.systemConfig.upsert({
    where: { key: configKey(context) },
    create: { key: configKey(context), value },
    update: { value },
  });
}

export async function loadAllAiConfigs(): Promise<{
  configs: Record<AiContext, { model: string } | null>;
  maskedKey: string | null;
}> {
  const keys = AI_CONTEXTS.map(configKey);
  const [rows, maskedKey] = await Promise.all([
    prisma.systemConfig.findMany({ where: { key: { in: keys } } }),
    maskedOpenRouterKey(),
  ]);

  const map = new Map(rows.map((r) => [r.key, r.value]));
  const configs = {} as Record<AiContext, { model: string } | null>;

  for (const ctx of AI_CONTEXTS) {
    const raw = map.get(configKey(ctx));
    if (!raw) {
      configs[ctx] = null;
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as { model?: string };
      configs[ctx] = parsed.model ? { model: parsed.model } : null;
    } catch {
      configs[ctx] = null;
    }
  }

  return { configs, maskedKey };
}
