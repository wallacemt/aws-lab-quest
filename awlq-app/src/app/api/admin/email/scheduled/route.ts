import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type SchedulePayload = {
  templateId?: string | null;
  subject?: string | null;
  targetMode?: "all-users" | "single-user" | "specific-users";
  userId?: string | null;
  userIds?: string[] | null;
};

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const triggers = await prisma.workerTrigger.findMany({
    where: { action: "email-send", processed: false, scheduledFor: { not: null } },
    orderBy: { scheduledFor: "asc" },
  });

  const scheduled = triggers.map((trigger) => {
    const payload = trigger.payload as SchedulePayload | null;
    return {
      id: trigger.id,
      scheduledFor: trigger.scheduledFor!.toISOString(),
      createdAt: trigger.createdAt.toISOString(),
      subject: payload?.subject ?? null,
      templateId: payload?.templateId ?? null,
      targetMode: payload?.targetMode ?? "all-users",
      userIdsCount: payload?.userIds?.length ?? 0,
    };
  });

  return NextResponse.json({ scheduled });
}
