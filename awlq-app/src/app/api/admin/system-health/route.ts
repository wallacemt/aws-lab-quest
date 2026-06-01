import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  const pendingTriggers = await prisma.workerTrigger.count({
    where: { processed: false },
  });

  return NextResponse.json({ pendingTriggers });
}
