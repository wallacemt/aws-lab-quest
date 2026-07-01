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
    const text = await response.text();
    let resetsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    try {
      const data = JSON.parse(text) as { resetsAt?: string };
      if (data.resetsAt) resetsAt = data.resetsAt;
    } catch {}
    throw new DailyLimitError(resetsAt);
  }

  if (!response.ok) {
    // Read as text first so a non-JSON body (e.g. 500 HTML) never causes a
    // parse crash — the error is surfaced as a plain message instead.
    const text = await response.text();
    let errorMsg = `Erro ${response.status}`;
    try {
      const data = JSON.parse(text) as { error?: string };
      errorMsg = data.error ?? errorMsg;
    } catch {
      // ponytail: non-JSON body — generic message is fine
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<AskAnswer>;
}
