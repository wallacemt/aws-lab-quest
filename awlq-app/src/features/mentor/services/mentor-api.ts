/**
 * Client-side fetchers for the mentor API routes.
 */

export type MentorRecommendation = {
  id: string;
  rank: number;
  actionType: string;
  targetRef: string | null;
  title: string;
  rationale: string;
  priorityScore: number;
  generatedAt: string;
};

export type MentorData = {
  recommendations: MentorRecommendation[];
  generatedAt: string | null;
};

export async function fetchMentorRecommendations(): Promise<MentorData> {
  const response = await fetch("/api/mentor");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mentor API error ${response.status}: ${text}`);
  }
  return response.json() as Promise<MentorData>;
}

export type AskStatus = {
  canAsk: boolean;
  resetsAt: string | null;
};

export type AskAnswer = {
  answer: string;
  resetsAt: string;
};

export class DailyLimitError extends Error {
  resetsAt: string;
  constructor(resetsAt: string) {
    super("daily_limit");
    this.resetsAt = resetsAt;
  }
}

export async function fetchAskStatus(): Promise<AskStatus> {
  const response = await fetch("/api/mentor/ask");
  if (!response.ok) {
    throw new Error(`Ask status error ${response.status}`);
  }
  return response.json() as Promise<AskStatus>;
}

export async function askMentorQuestion(question: string): Promise<AskAnswer> {
  const response = await fetch("/api/mentor/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (response.status === 429) {
    const data = (await response.json()) as { resetsAt: string };
    throw new DailyLimitError(data.resetsAt);
  }

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? `Erro ${response.status}`);
  }

  return response.json() as Promise<AskAnswer>;
}
