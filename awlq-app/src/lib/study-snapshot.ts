export type SnapshotViewer = "owner" | "admin" | "public";

export type SnapshotItem = Record<string, unknown> & {
  questionId: string;
};

export type SnapshotSanitizeResult =
  | { item: SnapshotItem | null; error: string | null };

const FIELD_LIMITS = {
  statement: 4 * 1024,
  options: 1024,
  explanations: 4 * 1024,
  explanationSummary: 8 * 1024,
} as const;

export function sanitizeSnapshotItem(input: unknown): SnapshotSanitizeResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { item: null, error: null };
  }

  const source = input as Record<string, unknown>;
  if (typeof source.questionId !== "string" || source.questionId.trim().length === 0) {
    return { item: null, error: null };
  }

  if (source.questionId.length > 64) {
    return { item: null, error: "questionId" };
  }

  for (const field of ["statement", "explanationSummary"] as const) {
    const value = source[field];
    const limit = FIELD_LIMITS[field];
    if (typeof value === "string" && value.length > limit) {
      return { item: null, error: field };
    }
  }

  for (const field of ["options", "explanations"] as const) {
    const values = source[field];
    if (!values || typeof values !== "object" || Array.isArray(values)) continue;
    const limit = FIELD_LIMITS[field];
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "string" && value.length > limit) {
        return { item: null, error: `${field}.${key}` };
      }
    }
  }

  const item: Record<string, unknown> = { ...source, questionId: source.questionId.trim() };
  const timeSpentSeconds = source.timeSpentSeconds;
  if (typeof timeSpentSeconds === "number" && Number.isFinite(timeSpentSeconds)) {
    item.timeSpentSeconds = Math.min(86400, Math.max(0, Math.round(timeSpentSeconds)));
  } else {
    delete item.timeSpentSeconds;
  }

  item.confidence = source.confidence === "high" || source.confidence === "medium" || source.confidence === "low"
    ? source.confidence
    : null;
  item.markedForReview = source.markedForReview === true;

  return { item: item as SnapshotItem, error: null };
}

export function projectSnapshotForViewer<T extends Record<string, unknown>>(
  items: T[],
  viewer: SnapshotViewer,
): T[] {
  if (viewer === "owner" || viewer === "admin") return items;

  return items.map((source) => {
    const item = { ...source };
    delete item.timeSpentSeconds;
    delete item.confidence;
    delete item.markedForReview;
    return item;
  });
}

export const MAX_STUDY_BODY_BYTES = 1024 * 1024;

export async function readJsonWithBodyLimit(request: Request): Promise<
  | { body: unknown; error: null }
  | { body: null; error: "too-large" | "invalid-json" }
> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_STUDY_BODY_BYTES) {
    return { body: null, error: "too-large" };
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_STUDY_BODY_BYTES) return { body: null, error: "too-large" };

  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)), error: null };
  } catch {
    return { body: null, error: "invalid-json" };
  }
}
