import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { loadOpenRouterKey } from "@/lib/ai-config";

const BENCHMARK_PROMPT = "Explique em uma frase o que é o Amazon S3 e para que serve.";
const TIMEOUT_MS = 15_000;

// apiKey is optional — falls back to the stored global key
type BenchmarkBody = { apiKey?: string; model: string; prompt?: string };

type BenchmarkOk = {
  latencyMs: number;
  ttfbMs: number;
  tokens?: { prompt: number; completion: number };
  preview: string;
};

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => null)) as BenchmarkBody | null;
  if (!body?.model?.trim()) {
    return NextResponse.json({ error: "model obrigatorio" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim() || (await loadOpenRouterKey()) || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Chave OpenRouter nao configurada. Salve a chave no painel antes de testar." }, { status: 400 });
  }

  const prompt = body.prompt?.trim() || BENCHMARK_PROMPT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const start = Date.now();
  let ttfbMs = 0;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL ?? "https://awslabquest.com",
        "X-Title": "AWS Lab Quest Benchmark",
      },
      body: JSON.stringify({
        model: body.model.trim(),
        messages: [{ role: "user", content: prompt }],
        max_tokens: 256,
      }),
    });

    ttfbMs = Date.now() - start;

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      return NextResponse.json({ error: `OpenRouter ${res.status}: ${detail}` }, { status: 502 });
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const latencyMs = Date.now() - start;
    const content = data.choices[0]?.message?.content ?? "";

    const result: BenchmarkOk = {
      latencyMs,
      ttfbMs,
      preview: content.slice(0, 300),
      ...(data.usage
        ? { tokens: { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens } }
        : {}),
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
