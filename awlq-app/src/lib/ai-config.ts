import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type AiContext = "QUESTION_GENERATION" | "QUESTION_EXPLAIN" | "SIMULADO_MESSAGE" | "LAB_GENERATION";

export const AI_CONTEXTS: AiContext[] = [
  "QUESTION_GENERATION",
  "QUESTION_EXPLAIN",
  "SIMULADO_MESSAGE",
  "LAB_GENERATION",
];

export const AI_CONTEXT_LABELS: Record<AiContext, string> = {
  QUESTION_GENERATION: "Geracao de questoes",
  QUESTION_EXPLAIN: "Explicacao de questoes",
  SIMULADO_MESSAGE: "Mensagem motivacional",
  LAB_GENERATION: "Geracao de labs",
};

type StoredAiConfig = {
  model: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
};

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw) throw new Error("ENCRYPTION_KEY nao configurada");
  const hash = crypto.createHash("sha256").update(raw).digest();
  return hash;
}

export function encryptApiKey(plaintext: string): Pick<StoredAiConfig, "encryptedKey" | "iv" | "authTag"> {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedKey: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

export function decryptApiKey(stored: Pick<StoredAiConfig, "encryptedKey" | "iv" | "authTag">): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(stored.iv, "hex");
  const authTag = Buffer.from(stored.authTag, "hex");
  const encryptedBuf = Buffer.from(stored.encryptedKey, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encryptedBuf).toString("utf8") + decipher.final("utf8");
}

function configKey(context: AiContext): string {
  return `ai_config:${context}`;
}

export async function loadAiConfig(context: AiContext): Promise<{ model: string; apiKey: string } | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key: configKey(context) } });
  if (!row) return null;
  try {
    const stored = JSON.parse(row.value) as StoredAiConfig;
    const apiKey = decryptApiKey(stored);
    return { model: stored.model, apiKey };
  } catch {
    return null;
  }
}

export async function saveAiConfig(context: AiContext, model: string, plainApiKey: string): Promise<void> {
  const encrypted = encryptApiKey(plainApiKey);
  const stored: StoredAiConfig = { model, ...encrypted };
  await prisma.systemConfig.upsert({
    where: { key: configKey(context) },
    create: { key: configKey(context), value: JSON.stringify(stored) },
    update: { value: JSON.stringify(stored) },
  });
}

export async function loadAllAiConfigs(): Promise<
  Record<AiContext, { model: string; maskedKey: string } | null>
> {
  const keys = AI_CONTEXTS.map(configKey);
  const rows = await prisma.systemConfig.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const result = {} as Record<AiContext, { model: string; maskedKey: string } | null>;
  for (const ctx of AI_CONTEXTS) {
    const raw = map.get(configKey(ctx));
    if (!raw) {
      result[ctx] = null;
      continue;
    }
    try {
      const stored = JSON.parse(raw) as StoredAiConfig;
      const plainKey = decryptApiKey(stored);
      const masked =
        plainKey.length <= 8
          ? "***"
          : `${plainKey.slice(0, 4)}${"*".repeat(Math.max(4, plainKey.length - 8))}${plainKey.slice(-4)}`;
      result[ctx] = { model: stored.model, maskedKey: masked };
    } catch {
      result[ctx] = null;
    }
  }
  return result;
}
