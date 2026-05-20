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

  return NextResponse.json({ services: servicesWithCount });
}
