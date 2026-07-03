import { callAI } from "../ai.js";
import { logger } from "../shared/logger.js";

type EmailContext = {
  name: string;
  triggerCode: string;
  daysSinceLastSession?: number;
  streakDays?: number;
  recentScoreAvg?: number;
  certificationCode?: string;
  sessionCountLast7Days?: number;
};

type GeneratedEmail = {
  subject: string;
  htmlBody: string;
};

function buildTriggerDescription(ctx: EmailContext): string {
  switch (ctx.triggerCode) {
    case "churn_risk":
      return `Usuário estudou regularmente por ${ctx.sessionCountLast7Days ?? 0} sessões nos últimos 7 dias mas está há ${ctx.daysSinceLastSession ?? 0} dias sem acessar`;
    case "streak_milestone":
      return "Usuário completou 7 dias consecutivos de estudo — momento de celebrar!";
    case "score_improvement":
      return `Pontuação crescendo nas últimas sessões, média atual: ${ctx.recentScoreAvg ?? 0}%`;
    case "score_slump":
      return `Queda de desempenho nas últimas sessões, média atual: ${ctx.recentScoreAvg ?? 0}%`;
    default:
      return "Atividade recente detectada na plataforma";
  }
}

function buildPrompt(ctx: EmailContext): string {
  return `Você é um assistente educacional para a plataforma AWS Lab Quest.
Gere um email motivacional personalizado em português brasileiro.

Nome do usuário: ${ctx.name}
Situação: ${buildTriggerDescription(ctx)}
Certificação sendo estudada: ${ctx.certificationCode ?? "AWS"}

Requisitos:
- Tom: encorajador, direto, estilo retro-gamer AWS
- Subject: máximo 60 caracteres, personalizado com o nome
- Body HTML: cabeçalho simples, 2-3 parágrafos, call-to-action com link https://awslabquest.com
- Use cor #f97316 para destaques e botão CTA
- Fundo escuro (#0f1929), texto claro (#e2e8f0)
- NÃO inclua links de unsubscribe

Responda APENAS com JSON válido (sem markdown, sem \`\`\`):
{"subject": "...", "htmlBody": "..."}`;
}

export async function generatePersonalizedEmail(ctx: EmailContext): Promise<GeneratedEmail> {
  const prompt = buildPrompt(ctx);

  let rawResponse: string;
  try {
    rawResponse = await callAI(prompt, "WORKER_EMAIL");
  } catch (err) {
    throw new Error(`AI call failed for user ${ctx.name}: ${String(err)}`);
  }

  // Strip any accidental markdown code fences
  const cleaned = rawResponse
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: GeneratedEmail;
  try {
    parsed = JSON.parse(cleaned) as GeneratedEmail;
  } catch {
    logger.error({ rawResponse, cleaned }, "personalized-email-generator: JSON parse failed");
    throw new Error(`Failed to parse AI response as JSON for user ${ctx.name}`);
  }

  if (!parsed.subject || !parsed.htmlBody) {
    throw new Error(`AI returned incomplete email payload for user ${ctx.name}`);
  }

  return parsed;
}
