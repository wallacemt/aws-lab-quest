import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GAP_CLEAR_THRESHOLD } from "@/lib/gap-progress";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const topic = searchParams.get("topic")?.trim();
  const awsServiceId = searchParams.get("sid")?.trim() || null;

  if (!topic) {
    return NextResponse.json({ error: "Missing topic." }, { status: 400 });
  }

  const progress = await prisma.userGapProgress.findFirst({
    where: { userId: session.user.id, awsServiceId, topic },
    select: { consecutiveCorrect: true, cleared: true },
  });

  return NextResponse.json({
    consecutiveCorrect: progress?.consecutiveCorrect ?? 0,
    cleared: progress?.cleared ?? false,
    threshold: GAP_CLEAR_THRESHOLD,
  });
}
