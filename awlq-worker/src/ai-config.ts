/**
 * Loads the OpenRouter API key from SystemConfig (encrypted) or falls back to env.
 * Mirrors the app's ai-config.ts encryption logic without sharing code across packages.
 */

import crypto from "crypto";
import { prisma } from "./prisma.js";

type EncryptedBlob = { encryptedKey: string; iv: string; authTag: string };

const GLOBAL_KEY_ROW = "openrouter_api_key";

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw) throw new Error("ENCRYPTION_KEY nao configurada");
  return crypto.createHash("sha256").update(raw).digest();
}

function decryptKey(stored: EncryptedBlob): string {
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

/** Returns the OpenRouter key from DB or OPENROUTER_API_KEY env, or null if neither is set. */
export async function loadOpenRouterKey(): Promise<string | null> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: GLOBAL_KEY_ROW } });
    if (row) {
      const blob = JSON.parse(row.value) as EncryptedBlob;
      return decryptKey(blob);
    }
  } catch (err) {
    // Log so misconfiguration (e.g. missing ENCRYPTION_KEY) is visible in worker logs
    console.warn("[ai-config] Failed to load OpenRouter key from DB:", err instanceof Error ? err.message : err);
  }
  return process.env.OPENROUTER_API_KEY ?? null;
}

/** Loads the model for a context from SystemConfig, falling back to AI_MODEL env or default. */
export async function loadContextModel(context: string): Promise<string> {
  try {
    const row = await prisma.systemConfig.findUnique({
      where: { key: `ai_config:${context}` },
    });
    if (row) {
      const parsed = JSON.parse(row.value) as { model?: string };
      if (parsed.model?.trim()) return parsed.model.trim();
    }
  } catch {
    // fall through
  }
  return process.env.AI_MODEL ?? "openrouter/free";
}
