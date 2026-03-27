import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderDailyPraticeInviteTemplate } from "@/features/admin/email/templates";

type Body = {
  userIds?: string[];
};

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];
  devAuditLog("admin.users.engagement-invite.request", {
    adminUserId: adminCheck.userId,
    targetedUsers: userIds.length,
  });

  const users = await prisma.user.findMany({
    where: {
      role: "user",
      active: true,
      accessStatus: "approved",
      ...(userIds.length > 0 ? { id: { in: userIds } } : {}),
    },
    select: {
      email: true,
      name: true,
    },
    take: 500,
  });

  let sent = 0;

  for (const user of users) {
    try {
      const content = renderDailyPraticeInviteTemplate({ name: user.name });
      await sendEmail({
        to: user.email,
        subject: content.subject,
        html: content.html,
      });
      sent += 1;
    } catch {
      // Continue sending for remaining users.
    }
  }

  devAuditLog("admin.users.engagement-invite.completed", {
    adminUserId: adminCheck.userId,
    selectedUsers: users.length,
    sent,
  });

  return NextResponse.json({ sent });
}
