import { config } from "./config.js";
import { loadOpenRouterKey, loadContextModel } from "./ai-config.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 3000;

let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = config.ai.minCallIntervalMs - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

async function callOnce(prompt: string, apiKey: string, model: string): Promise<string> {
  await throttle();

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": config.app.url,
      "X-Title": "AWS Lab Quest Worker",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter error ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? "";
}

// ponytail: free-tier OpenRouter traffic hits transient network failures often enough
// that a single fetch failure shouldn't zero out an entire generation batch — retry a
// couple of times before giving up.
export async function callAI(prompt: string, context: string): Promise<string> {
  const [apiKey, model] = await Promise.all([
    loadOpenRouterKey(),
    loadContextModel(context),
  ]);

  if (!apiKey) {
    throw new Error(
      `IA nao configurada para contexto ${context}. Configure OPENROUTER_API_KEY ou use o painel admin.`,
    );
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callOnce(prompt, apiKey, model);
    } catch (err) {
      lastErr = err;
      const isNetworkError = err instanceof TypeError;
      if (!isNetworkError || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw lastErr;
}
