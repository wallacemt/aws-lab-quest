import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ bossId: string }> };

/**
 * GET /api/arena/bosses/[bossId]/questions?count=5
 * Returns questions filtered by the boss's themeService (AwsService.code).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const { bossId } = await params;
  const countParam = request.nextUrl.searchParams.get("count");
  const count = Math.min(20, Math.max(1, parseInt(countParam ?? "5", 10)));

  const boss = await prisma.boss.findUnique({
    where: { id: bossId, active: true },
    select: { themeService: true },
  });

  if (!boss) {
    return NextResponse.json({ error: "Boss not found." }, { status: 404 });
  }

  // Find the AwsService by code, then filter questions
  const service = await prisma.awsService.findUnique({
    where: { code: boss.themeService },
    select: { id: true },
  });

  const where = service
    ? { active: true, awsServiceId: service.id }
    : { active: true };

  const pool = await prisma.studyQuestion.findMany({
    where,
    select: {
      id: true,
      statement: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      optionE: true,
    },
    take: count * 5,
  });

  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count);

  return NextResponse.json({ questions: shuffled });
}
