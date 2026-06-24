import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ApprovedUserResult =
  | { user: { id: string; email: string }; response: null }
  | { user: null; response: NextResponse };

/**
 * Verifies that the request has a valid session AND that the user's account
 * has been approved by an admin.
 *
 * Pending and rejected users receive 403 rather than being treated the same
 * as unauthenticated requests — this preserves the distinct HTTP semantics
 * (401 = no identity, 403 = identity known but access denied).
 *
 * Note: `accessStatus` lives on the User model directly, not on UserProfile.
 */
export async function requireApprovedUser(request: NextRequest): Promise<ApprovedUserResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, accessStatus: true },
  });

  if (!user || user.accessStatus !== "approved") {
    return {
      user: null,
      response: NextResponse.json({ error: "Access pending approval" }, { status: 403 }),
    };
  }

  return { user: { id: user.id, email: user.email }, response: null };
}
