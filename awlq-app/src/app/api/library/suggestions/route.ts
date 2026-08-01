import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { getContextualLibraryContent } from "@/features/library/services/library-context";

/**
 * GET /api/library/suggestions
 *
 * Client-fetchable wrapper around getContextualLibraryContent, for study/arena
 * review screens that are Client Components and can't call it directly.
 *
 * Query params: awsServiceId?, questChainId?
 */
export async function GET(request: NextRequest) {
  const { response } = await requireApprovedUser(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const awsServiceId = searchParams.get("awsServiceId") ?? undefined;
  const questChainId = searchParams.get("questChainId") ?? undefined;

  const content = await getContextualLibraryContent({ awsServiceId, questChainId });
  return NextResponse.json({ content });
}
