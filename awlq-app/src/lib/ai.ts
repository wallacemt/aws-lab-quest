import { type AiContext, loadAiConfig } from "@/lib/ai-config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// ponytail: openrouter/free delegates model selection to the router — avoids hardcoded slugs that go stale
const DEFAULT_MODEL = "openrouter/free";
const DEFAULT_MAX_TOKENS = 4096;

export class AiNotConfiguredError extends Error {
  constructor() {
    super("IA nao configurada. Configure a chave OpenRouter no painel admin.");
    this.name = "AiNotConfiguredError";
  }
}

type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenRouterResponse = {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

async function resolveConfig(context: AiContext): Promise<{ model: string; apiKey: string }> {
  const dbConfig = await loadAiConfig(context).catch(() => null);
  if (dbConfig) return dbConfig;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();

  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;
  return { apiKey, model };
}

async function fetchOpenRouter(
  messages: OpenRouterMessage[],
  model: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL ?? "https://awslabquest.com",
      "X-Title": "AWS Lab Quest",
    },
    body: JSON.stringify({ model, messages, max_tokens: DEFAULT_MAX_TOKENS }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter error ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content ?? "";
}

export async function callAI(prompt: string, context: AiContext): Promise<string> {
  const { model, apiKey } = await resolveConfig(context);
  return fetchOpenRouter([{ role: "user", content: prompt }], model, apiKey);
}

export async function callAIWithSystem(
  prompt: string,
  context: AiContext,
  systemInstruction: string,
): Promise<string> {
  const { model, apiKey } = await resolveConfig(context);
  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt },
  ];
  return fetchOpenRouter(messages, model, apiKey);
}

/** Extracts the first JSON object found in a text string. */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  // ponytail: LLMs routinely leave a trailing comma before "]"/"}" — safe to
  // strip since a trailing comma is never valid JSON, so this can't corrupt
  // an otherwise-correct payload.
  return text.slice(start, end + 1).replace(/,(\s*[\]}])/g, "$1");
}
