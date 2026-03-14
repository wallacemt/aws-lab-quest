import { GoogleGenerativeAI } from "@google/generative-ai";

export function getAiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao configurada.");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const preferredModel = process.env.GEMINI_MODEL ?? "gemma-3-4b-it";
  return client.getGenerativeModel({ model: preferredModel });
}

export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
