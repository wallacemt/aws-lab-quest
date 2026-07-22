import { callAI } from "../ai.js";
import { logger } from "../shared/logger.js";

const MAX_LENGTH = 40;

function buildPrompt(): string {
  return `Você é um narrador de RPG retro para a plataforma AWS Lab Quest.
Gere um nome curto e criativo em português brasileiro para o Desafio Semanal
desta semana — um evento de perguntas sobre AWS onde os usuários competem em
um ranking.

Requisitos:
- Máximo ${MAX_LENGTH} caracteres
- Estilo pixel-art RPG (ex: "A Fúria do CloudFormation", "Invasão Serverless")
- Pode referenciar temas AWS (computação, storage, IAM, redes, containers, etc) de forma criativa
- Responda APENAS com o título, sem aspas, sem markdown, sem explicação`;
}

function fallbackTitle(weekStart: Date): string {
  const formatted = weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return `Desafio da Semana de ${formatted}`;
}

/** Never throws — falls back to a deterministic title so the cron job never gets blocked by an AI outage. */
export async function generateWeeklyChallengeTitle(weekStart: Date): Promise<string> {
  try {
    const raw = await callAI(buildPrompt(), "WORKER_WEEKLY_CHALLENGE_TITLE");
    const cleaned = raw.trim().replace(/^["']|["']$/g, "").slice(0, MAX_LENGTH).trim();
    if (cleaned) return cleaned;
  } catch (err) {
    logger.warn({ err }, "weekly-challenge-title: AI generation failed, using fallback");
  }
  return fallbackTitle(weekStart);
}
