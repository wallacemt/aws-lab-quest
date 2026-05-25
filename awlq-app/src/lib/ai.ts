import { GoogleGenerativeAI } from "@google/generative-ai";
import { type AiContext, loadAiConfig } from "@/lib/ai-config";

function buildGeminiClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey);
}

export async function getAiModelForContext(context: AiContext) {
  let apiKey: string | undefined;
  let model: string | undefined;

  try {
    const dbConfig = await loadAiConfig(context);
    if (dbConfig) {
      apiKey = dbConfig.apiKey;
      model = dbConfig.model;
    }
  } catch {
    // fall through to env vars
  }

  apiKey ??= process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chave de API de IA nao configurada.");

  model ??= process.env.GEMINI_MODEL ?? "gemma-3-4b-it";

  const client = buildGeminiClient(apiKey);
  return client.getGenerativeModel({ model });
}

export function getAiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao configurada.");
  }
  const preferredModel = process.env.GEMINI_MODEL ?? "gemma-3-4b-it";
  return buildGeminiClient(apiKey).getGenerativeModel({ model: preferredModel });
}

export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
