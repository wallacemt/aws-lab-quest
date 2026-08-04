import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { cacheDel, CACHE_KEYS } from "@/lib/cache";

type PrivacySettingsBody = {
  leaderboardVisible?: boolean;
  notifyFlashcardEmails?: boolean;
  notifyEngagementEmails?: boolean;
  notifyProductUpdateEmails?: boolean;
};

const EMAIL_PREF_KEYS = ["notifyFlashcardEmails", "notifyEngagementEmails", "notifyProductUpdateEmails"] as const;

export async function PATCH(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as PrivacySettingsBody;

  const fields = ["leaderboardVisible", ...EMAIL_PREF_KEYS] as const;
  for (const key of fields) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      return NextResponse.json({ error: `${key} must be a boolean.` }, { status: 400 });
    }
  }

  if (fields.every((key) => body[key] === undefined)) {
    return NextResponse.json({ error: "No valid setting provided." }, { status: 400 });
  }

  if (body.leaderboardVisible !== undefined) {
    await prisma.userProfile.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, leaderboardVisible: body.leaderboardVisible },
      update: { leaderboardVisible: body.leaderboardVisible },
    });

    // Invalidate leaderboard cache so the change takes effect immediately
    await cacheDel(CACHE_KEYS.leaderboard());
  }

  // Granular, opt-in email consent (LGPD Art. 8) — only touch keys the caller sent.
  const emailPrefUpdate = Object.fromEntries(
    EMAIL_PREF_KEYS.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]),
  );

  if (Object.keys(emailPrefUpdate).length > 0) {
    await prisma.user.update({ where: { id: auth.user.id }, data: emailPrefUpdate });
    await cacheDel(CACHE_KEYS.userProfile(auth.user.id));
  }

  return NextResponse.json({ ok: true });
}
