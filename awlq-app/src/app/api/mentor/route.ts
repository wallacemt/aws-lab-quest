import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mentor
 *
 * Returns the most recent MentorRecommendation set for the authenticated user.
 * Recommendations are computed asynchronously by the mentor-compute worker
 * after each study session — this route is read-only.
 *
 * If no recommendations exist yet, returns an empty list with null generatedAt.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  // Find the timestamp of the latest batch for this user
  const latest = await prisma.mentorRecommendation.findFirst({
    where: { userId: auth.user.id },
    orderBy: { generatedAt: "desc" },
    select: { generatedAt: true },
  });

  if (!latest) {
    return NextResponse.json({ recommendations: [], generatedAt: null });
  }

  // Fetch all recommendations from that same generation run (same generatedAt second)
  const rawRecommendations = await prisma.mentorRecommendation.findMany({
    where: {
      userId: auth.user.id,
      generatedAt: latest.generatedAt,
    },
    orderBy: { rank: "asc" },
    select: {
      id: true,
      rank: true,
      actionType: true,
      targetRef: true,
      title: true,
      rationale: true,
      priorityScore: true,
      generatedAt: true,
    },
  });

  // For "library" recommendations, rewrite targetRef to a pre-filtered
  // biblioteca URL so the client link lands on the correct service view.
  const recommendations = rawRecommendations.map((rec) => {
    if (rec.actionType === "library" && rec.targetRef) {
      return {
        ...rec,
        targetRef: `/biblioteca?serviceCode=${encodeURIComponent(rec.targetRef)}`,
      };
    }
    return rec;
  });

  return NextResponse.json({ recommendations, generatedAt: latest.generatedAt });
}
