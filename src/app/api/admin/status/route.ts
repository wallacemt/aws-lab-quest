import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  return NextResponse.json({
    ready: true,
    admin: {
      userId: adminCheck.userId,
      email: adminCheck.email,
      role: adminCheck.role,
    },
  });
}
