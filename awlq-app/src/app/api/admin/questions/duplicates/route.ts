import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export type DuplicateGroup = {
  ids: string[];
  statements: string[];
  externalIds: string[];
  certificationCode: string | null;
};

type SimilarPair = {
  id1: string;
  statement1: string;
  external_id1: string;
  cert_code1: string | null;
  id2: string;
  statement2: string;
  external_id2: string;
  cert_code2: string | null;
};

type PrefixRow = {
  ids: string;
  statements: string;
  external_ids: string;
  cert_code: string | null;
};

function buildGroupsFromPairs(pairs: SimilarPair[], certificationCode: string): DuplicateGroup[] {
  const filtered = certificationCode
    ? pairs.filter((p) => p.cert_code1 === certificationCode || p.cert_code2 === certificationCode)
    : pairs;

  const parent = new Map<string, string>();
  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id);
    const p = parent.get(id)!;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  }
  function union(a: string, b: string) {
    parent.set(find(a), find(b));
  }

  const meta = new Map<string, { statement: string; externalId: string; certCode: string | null }>();
  for (const pair of filtered) {
    meta.set(pair.id1, { statement: pair.statement1, externalId: pair.external_id1, certCode: pair.cert_code1 });
    meta.set(pair.id2, { statement: pair.statement2, externalId: pair.external_id2, certCode: pair.cert_code2 });
    union(pair.id1, pair.id2);
  }

  const groupMap = new Map<string, string[]>();
  for (const id of meta.keys()) {
    const root = find(id);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(id);
  }

  return Array.from(groupMap.values())
    .filter((ids) => ids.length > 1)
    .slice(0, 100)
    .map((ids) => ({
      ids,
      statements: ids.map((id) => (meta.get(id)?.statement ?? "").slice(0, 200)),
      externalIds: ids.map((id) => meta.get(id)?.externalId ?? ""),
      certificationCode: meta.get(ids[0]!)?.certCode ?? null,
    }));
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const certificationCode = request.nextUrl.searchParams.get("certificationCode")?.trim() ?? "";

  try {
    const pairs = await prisma.$queryRaw<SimilarPair[]>`
      SELECT
        q1.id AS id1,
        q1.statement AS statement1,
        q1."externalId" AS external_id1,
        cp1.code AS cert_code1,
        q2.id AS id2,
        q2.statement AS statement2,
        q2."externalId" AS external_id2,
        cp2.code AS cert_code2
      FROM "StudyQuestion" q1
      JOIN "StudyQuestion" q2 ON q1.id < q2.id
      LEFT JOIN "CertificationPreset" cp1 ON q1."certificationPresetId" = cp1.id
      LEFT JOIN "CertificationPreset" cp2 ON q2."certificationPresetId" = cp2.id
      WHERE similarity(
          LOWER(REGEXP_REPLACE(q1.statement, '\\s+', ' ', 'g')),
          LOWER(REGEXP_REPLACE(q2.statement, '\\s+', ' ', 'g'))
        ) > 0.80
      LIMIT 500
    `;

    const groups = buildGroupsFromPairs(pairs, certificationCode);
    return NextResponse.json({ groups, method: "similarity", total: groups.length });
  } catch {
    // pg_trgm not available — fallback to prefix grouping
    const rows = await prisma.$queryRaw<PrefixRow[]>`
      SELECT
        STRING_AGG(q.id::text, '|') AS ids,
        STRING_AGG(q.statement, '|||') AS statements,
        STRING_AGG(q."externalId", '|') AS external_ids,
        MIN(cp.code) AS cert_code
      FROM "StudyQuestion" q
      LEFT JOIN "CertificationPreset" cp ON q."certificationPresetId" = cp.id
      GROUP BY LEFT(LOWER(REGEXP_REPLACE(q.statement, '\\s+', ' ', 'g')), 120)
      HAVING COUNT(*) > 1
      LIMIT 100
    `;

    const allGroups: DuplicateGroup[] = rows.map((row) => ({
      ids: row.ids.split("|"),
      statements: row.statements.split("|||").map((s) => s.slice(0, 200)),
      externalIds: row.external_ids.split("|"),
      certificationCode: row.cert_code,
    }));

    const groups = certificationCode
      ? allGroups.filter((g) => g.certificationCode === certificationCode)
      : allGroups;

    return NextResponse.json({ groups, method: "prefix", total: groups.length });
  }
}
