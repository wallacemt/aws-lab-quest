const ROUTE_DOMAINS: Record<string, string> = {
  users: "users",
  questions: "questions",
  uploads: "ingestion",
  pdf: "ingestion",
  "ingestion-sources": "ingestion",
  "simulado-packs": "simulados",
  achievements: "gamification",
  arena: "gamification",
  themes: "gamification",
  "weekly-challenge": "gamification",
  trails: "content",
  certifications: "content",
  library: "content",
  changelog: "content",
  "news-sources": "content",
  "home-config": "content",
  email: "email",
  "behavioral-email": "email",
  worker: "ops",
  "scheduled-jobs": "ops",
  status: "ops",
  "system-health": "ops",
  config: "ops",
  "ai-config": "ops",
  "openrouter-models": "ops",
  "pollinations-models": "ops",
  metrics: "metrics",
  mcp: "platform",
  audit: "platform",
};

/** Maps a route's first path segment to its audit domain; unknown routes stay in platform. */
export function routeDomain(path: string): string {
  const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
  return ROUTE_DOMAINS[firstSegment] ?? "platform";
}
