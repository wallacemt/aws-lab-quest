import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config.js";

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

let lastCallAt = 0;

export async function callGemini(prompt: string): Promise<string> {
  const now = Date.now();
  const wait = config.gemini.minCallIntervalMs - (now - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  lastCallAt = Date.now();

  const model = genAI.getGenerativeModel({ model: config.gemini.model });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
