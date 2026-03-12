import { Task, TaskDifficulty } from "@/lib/types";

function parseDifficulty(value: unknown): TaskDifficulty {
  const normalized = String(value ?? "")
    .toLowerCase()
    .trim();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }
  return "medium";
}

function normalizeTask(task: Partial<Task>, index: number): Task {
  return {
    id: typeof task.id === "number" ? task.id : index + 1,
    title: String(task.title ?? `Missao ${index + 1}`),
    mission: String(task.mission ?? "Conclua esta etapa do laboratorio."),
    service: String(task.service ?? "AWS"),
    analogy: String(task.analogy ?? "Pense nisso como uma fase importante da jornada."),
    steps: Array.isArray(task.steps) ? task.steps.map((step) => String(step)) : [],
    difficulty: parseDifficulty(task.difficulty),
    completed: false,
  };
}

export function parseTasksFromText(rawText: string): Task[] {
  const text = rawText.trim();

  const direct = tryParseJsonArray(text);
  if (direct) {
    return direct.map(normalizeTask);
  }

  const cleaned = text.replace(/```json|```/gi, "").trim();
  const cleanedParsed = tryParseJsonArray(cleaned);
  if (cleanedParsed) {
    return cleanedParsed.map(normalizeTask);
  }

  const bracketMatch = cleaned.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    const extractedParsed = tryParseJsonArray(bracketMatch[0]);
    if (extractedParsed) {
      return extractedParsed.map(normalizeTask);
    }
  }

  throw new Error("A IA nao retornou um JSON de tarefas valido.");
}

function tryParseJsonArray(value: string): Partial<Task>[] | null {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
