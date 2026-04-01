import { GoogleGenerativeAI } from "@google/generative-ai";

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao configurada.");
  }

  return new GoogleGenerativeAI(apiKey);
}

export function getAiModel() {
  const client = getAiClient();
  const preferredModel = process.env.GEMINI_MODEL ?? "gemma-3-4b-it";
  return client.getGenerativeModel({ model: preferredModel });
}

export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
