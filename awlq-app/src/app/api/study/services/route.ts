import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const withCount = searchParams.get("withCount") === "true";
  const difficulty = searchParams.get("difficulty") ?? null;

  const services = await cacheGetOrSet(
    CACHE_KEYS.servicesList(),
    () =>
      prisma.awsService.findMany({
        where: { active: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, code: true, name: true, description: true },
      }),
    CACHE_TTL.SERVICES_LIST,
  );

  if (!withCount) {
    return NextResponse.json({ services });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { certificationPresetId: true },
  });

  if (!profile?.certificationPresetId) {
    return NextResponse.json({ services });
  }

  const certId = profile.certificationPresetId;
  const questionCounts = await cacheGetOrSet(
    CACHE_KEYS.servicesWithCount(certId, difficulty),
    () =>
      prisma.studyQuestion.groupBy({
        by: ["awsServiceId"],
        where: {
          active: true,
          certificationPresetId: certId,
          usage: { in: ["KC", "BOTH"] },
          ...(difficulty ? { difficulty: difficulty as "easy" | "medium" | "hard" | "nightmare" } : {}),
        },
        _count: { id: true },
      }),
    CACHE_TTL.SERVICES_COUNT,
  );

  const countMap = new Map(questionCounts.map((item) => [item.awsServiceId, item._count.id]));

  const servicesWithCount = services.map((service) => ({
    ...service,
    questionCount: countMap.get(service.id) ?? 0,
  }));

  // Deduplicate entries that differ only by "Amazon " / "AWS " prefix
  // (e.g. "Amazon EC2" and "EC2" are the same service in the DB seeded inconsistently).
  // Keep the entry with the canonical "Amazon X" / "AWS X" name when available, sum counts.
  const canonical = (name: string) => name.replace(/^(Amazon|AWS)\s+/i, "").toLowerCase();
  const seen = new Map<string, (typeof servicesWithCount)[0]>();
  for (const svc of servicesWithCount) {
    const key = canonical(svc.name);
    const existing = seen.get(key);
    if (!existing) { seen.set(key, svc); continue; }
    // Prefer prefixed name ("Amazon EC2" over "EC2"); merge counts.
    const preferCurrent = /^(Amazon|AWS)\s+/i.test(svc.name) || svc.questionCount > existing.questionCount;
    seen.set(key, {
      ...(preferCurrent ? svc : existing),
      questionCount: (existing.questionCount ?? 0) + (svc.questionCount ?? 0),
    });
  }
  const deduped = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ services: deduped });
}
