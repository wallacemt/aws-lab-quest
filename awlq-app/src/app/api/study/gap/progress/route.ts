import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { GAP_CLEAR_THRESHOLD } from "@/lib/gap-progress";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const topic = searchParams.get("topic")?.trim();
  const awsServiceId = searchParams.get("sid")?.trim() || null;

  if (!topic) {
    return NextResponse.json({ error: "Missing topic." }, { status: 400 });
  }

  const progress = await prisma.userGapProgress.findFirst({
    where: { userId: auth.user.id, awsServiceId, topic },
    select: { consecutiveCorrect: true, cleared: true },
  });

  return NextResponse.json({
    consecutiveCorrect: progress?.consecutiveCorrect ?? 0,
    cleared: progress?.cleared ?? false,
    threshold: GAP_CLEAR_THRESHOLD,
  });
}
