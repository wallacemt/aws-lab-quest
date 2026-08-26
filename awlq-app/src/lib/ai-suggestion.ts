import { NextResponse } from "next/server";
import { callAI, extractJsonObject, AiNotConfiguredError } from "@/lib/ai";
import type { AiContext } from "@/lib/ai-config";

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Shared engine behind every "Sugerir com IA" admin route: call the model,
 * extract/parse the JSON, retry on malformed output, give up after
 * maxAttempts. Prompt building and candidate validation stay per-route since
 * each content type (achievement, trail, boss, ...) has its own shape.
 */
export async function requestAiCandidates<T>({
  context,
  prompt,
  parseCandidates,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: {
  context: AiContext;
  prompt: string;
  parseCandidates: (parsed: unknown) => T[];
  maxAttempts?: number;
}): Promise<T[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const rawText = (await callAI(prompt, context)).trim();
      const jsonStr = extractJsonObject(rawText);
      if (!jsonStr) throw new Error("Resposta da IA nao e JSON valido.");

      const candidates = parseCandidates(JSON.parse(jsonStr));
      if (candidates.length === 0) throw new Error("Nenhuma sugestao da IA passou na validacao.");

      return candidates;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Erro ao gerar sugestoes.");
}

export function aiSuggestionErrorResponse(err: unknown): NextResponse {
  const status = err instanceof AiNotConfiguredError ? 503 : 502;
  const message = err instanceof Error ? err.message : "Erro ao gerar sugestoes.";
  return NextResponse.json({ error: message }, { status });
}
