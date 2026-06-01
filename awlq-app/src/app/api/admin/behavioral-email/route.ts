import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const MS_PER_DAY = 86_400_000;

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_PER_DAY);

  const [featureFlag, sentThisWeek, sentThisMonth, lastAnalyzedRow, recentEvents] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "behavioral_email_enabled" } }),
    prisma.userEmailEvent.count({ where: { sentAt: { gte: sevenDaysAgo } } }),
    prisma.userEmailEvent.count({ where: { sentAt: { gte: thirtyDaysAgo } } }),
    // Max lastAnalyzedAt across all behavior profiles
    prisma.userBehaviorProfile.findFirst({
      orderBy: { lastAnalyzedAt: "desc" },
      select: { lastAnalyzedAt: true },
    }),
    prisma.userEmailEvent.findMany({
      orderBy: { sentAt: "desc" },
      take: 20,
      select: {
        id: true,
        userId: true,
        triggerCode: true,
        subject: true,
        sentAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({
    enabled: featureFlag?.value !== "false",
    stats: {
      sentThisWeek,
      sentThisMonth,
      lastAnalyzedAt: lastAnalyzedRow?.lastAnalyzedAt?.toISOString() ?? null,
    },
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      userId: event.userId,
      userName: event.user.name,
      userEmail: event.user.email,
      triggerCode: event.triggerCode,
      subject: event.subject,
      sentAt: event.sentAt.toISOString(),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  let body: { enabled?: boolean };
  try {
    body = (await request.json()) as { enabled?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Field 'enabled' must be a boolean." }, { status: 400 });
  }

  await prisma.systemConfig.upsert({
    where: { key: "behavioral_email_enabled" },
    create: { key: "behavioral_email_enabled", value: body.enabled ? "true" : "false" },
    update: { value: body.enabled ? "true" : "false" },
  });

  return NextResponse.json({ ok: true, enabled: body.enabled });
}
