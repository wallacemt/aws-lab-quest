import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/study/kc/generate-status
 *
 * Polls the status of a background KC generation job.
 * Returns the current pool count so the client can determine readiness.
 *
 * Query params:
 *   requestId  — the generation request id returned by POST /questions
 *   topics     — comma-separated service codes (e.g. "EC2,S3")
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const requestId = searchParams.get("requestId");
  const topicsRaw = searchParams.get("topics") ?? "";
  const topics = topicsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Check whether the trigger for this request has been processed by the worker.
  let jobProcessed = false;
  if (requestId) {
    const trigger = await prisma.workerTrigger.findFirst({
      where: { payload: { path: ["requestId"], equals: requestId } },
      select: { processed: true },
    });
    jobProcessed = trigger?.processed ?? false;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { certificationPresetId: true },
  });

  // Count how many KC questions are now available for the requested topics.
  const whereClause = {
    active: true,
    usage: { in: ["KC", "BOTH"] as Array<"KC" | "BOTH"> },
    ...(profile?.certificationPresetId
      ? { certificationPresetId: profile.certificationPresetId }
      : {}),
    ...(topics.length > 0
      ? {
          OR: [
            { awsService: { code: { in: topics } } },
            { questionAwsServices: { some: { service: { code: { in: topics } } } } },
          ],
        }
      : {}),
  };

  const count = await prisma.studyQuestion.count({ where: whereClause });

  return NextResponse.json({ count, jobProcessed });
}
