/**
 * Client-side fetcher for the mentor API route.
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
