import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/study/kc/generate-status?requestId=&serviceCode=&topic=&difficulty=&count=
 *
 * Polls the status of a background KC generation job.
 * Returns the current question count so the client can decide when to backfill.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const serviceCode = searchParams.get("serviceCode");
  const topic = searchParams.get("topic");
  const difficulty = searchParams.get("difficulty") ?? "medium";

  if (!serviceCode && !topic) {
    return NextResponse.json({ error: "serviceCode or topic is required." }, { status: 400 });
  }

  // Check whether the trigger for this request has been processed.
  const requestId = searchParams.get("requestId");
  let jobProcessed = false;
  if (requestId) {
    const trigger = await prisma.workerTrigger.findFirst({
      where: { payload: { path: ["requestId"], equals: requestId } },
      select: { processed: true },
    });
    jobProcessed = trigger?.processed ?? false;
  }

  // Count available questions matching the criteria.
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { certificationPresetId: true },
  });

  const whereClause = {
    active: true,
    usage: { in: ["KC", "BOTH"] as Array<"KC" | "BOTH"> },
    difficulty: difficulty as "easy" | "medium" | "hard" | "nightmare",
    ...(profile?.certificationPresetId
      ? { certificationPresetId: profile.certificationPresetId }
      : {}),
    ...(serviceCode
      ? {
          OR: [
            { awsService: { code: serviceCode } },
            { questionAwsServices: { some: { service: { code: serviceCode } } } },
          ],
        }
      : topic
        ? { topic }
        : {}),
  };

  const count = await prisma.studyQuestion.count({ where: whereClause });

  return NextResponse.json({ count, jobProcessed });
}
