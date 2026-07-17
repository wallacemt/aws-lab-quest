/**
 * Client-side fetchers for the Quest Chain API routes.
 */

export type UnlockRule = {
  minScorePercent?: number;
  sessionType?: "KC" | "SIMULADO";
};

export type QuestStage = {
  id: string;
  position: number;
  title: string;
  awsServiceId: string | null;
  topic: string | null;
  unlockRule: UnlockRule | null;
  imageUrl: string | null;
  unlocked: boolean;
  completed: boolean;
  completedAt: string | null;
};

export type QuestChain = {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  certificationPresetId: string | null;
  stages: QuestStage[];
};

export type TrailsData = {
  chains: QuestChain[];
};

export type TrailQuestion = {
  id: string;
  statement: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Trails API error ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchTrails(): Promise<TrailsData> {
  return apiFetch<TrailsData>("/api/trails");
}

export async function completeStage(
  chainId: string,
  stageId: string,
): Promise<{ unlockedNext?: string }> {
  return apiFetch(`/api/trails/${chainId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stageId }),
  });
}

export async function fetchStageExplain(
  chainId: string,
  stageId: string,
): Promise<{ markdown: string; cached: boolean }> {
  return apiFetch(`/api/trails/${chainId}/stages/${stageId}/explain`, { method: "POST" });
}

export async function fetchStageQuestions(
  chainId: string,
  stageId: string,
): Promise<{ questions: TrailQuestion[] }> {
  return apiFetch(`/api/trails/${chainId}/stages/${stageId}/questions`, { method: "POST" });
}
