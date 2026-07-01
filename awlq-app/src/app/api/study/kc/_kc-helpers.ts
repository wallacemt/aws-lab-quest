/**
 * Shared helpers for KC question selection and poll readiness.
 * Both /questions and /generate-status must use the same difficulty-aware filter
 * so the poll count and the actual question fetch agree (DEF-001).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Shape written by feedback-analysis.worker (WeakAreaReport.weakAreas JSON field).
type WeakAreaEntry = {
  dimension: "service" | "topic";
  dimensionId: string;
  correctRate: number;
};

/**
 * Returns the set of service codes identified as gaps in the user's latest
 * WeakAreaReport. A gap is correctRate < 60% with enough attempts (as computed
 * by the worker). Always uses the most recent report.
 */
export async function fetchGapServiceCodes(certificationPresetId: string): Promise<Set<string>> {
  const report = await prisma.weakAreaReport.findFirst({
    where: { certificationPresetId },
    orderBy: { analyzedAt: "desc" },
    select: { weakAreas: true },
  });

  if (!report) return new Set();

  const entries = report.weakAreas as WeakAreaEntry[];
  if (!Array.isArray(entries)) return new Set();

  return new Set(
    entries
      .filter((e) => e.dimension === "service" && e.correctRate < 0.6)
      .map((e) => e.dimensionId.toUpperCase()),
  );
}

/**
 * Builds a Prisma WHERE clause with difficulty scaled per topic:
 * - Gap services  → hard / nightmare (close the knowledge gap)
 * - Other services → hard / medium  (challenging but not punishing)
 * When no topics are selected, falls back to a mixed hard/medium distribution.
 *
 * The top-level OR from baseWhere is replaced; all topic + difficulty
 * constraints are folded into the returned OR clauses.
 */
export function buildDifficultyAwareWhere(
  topics: string[],
  gapCodes: Set<string>,
  baseWhere: Prisma.StudyQuestionWhereInput,
): Prisma.StudyQuestionWhereInput {
  if (topics.length === 0) {
    return { ...baseWhere, difficulty: { in: ["hard", "medium"] } };
  }

  const gapTopics = topics.filter((t) => gapCodes.has(t.toUpperCase()));
  const normalTopics = topics.filter((t) => !gapCodes.has(t.toUpperCase()));

  const serviceFilter = (codes: string[]): Prisma.StudyQuestionWhereInput => ({
    OR: [
      { awsService: { code: { in: codes } } },
      { questionAwsServices: { some: { service: { code: { in: codes } } } } },
    ],
  });

  const orClauses: Prisma.StudyQuestionWhereInput[] = [];

  if (gapTopics.length > 0) {
    orClauses.push({ difficulty: { in: ["hard", "nightmare"] }, ...serviceFilter(gapTopics) });
  }

  if (normalTopics.length > 0) {
    orClauses.push({ difficulty: { in: ["hard", "medium"] }, ...serviceFilter(normalTopics) });
  }

  // Strip the top-level service OR that baseWhere might already carry;
  // per-clause service filters above replace it.
  const { OR: _unused, ...baseWithoutServiceFilter } = baseWhere as { OR?: unknown } & Prisma.StudyQuestionWhereInput;

  return { ...baseWithoutServiceFilter, OR: orClauses };
}
