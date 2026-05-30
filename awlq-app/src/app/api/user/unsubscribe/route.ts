import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

// LGPD Art. 18 — one-click unsubscribe from engagement emails.
// This endpoint is intentionally unauthenticated: the signed token in the URL
// is the proof of identity. No session is required so links work from email clients.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse("Token ausente.", { status: 400 });
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return new NextResponse("Token invalido ou expirado.", { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailNotifications: false },
  });

  // Redirect to a friendly confirmation page
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/unsubscribed`);
}
