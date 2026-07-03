import { config } from "./config.js";
import { loadOpenRouterKey, loadContextModel } from "./ai-config.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = config.ai.minCallIntervalMs - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

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
