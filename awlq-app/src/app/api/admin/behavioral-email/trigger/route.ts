import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  await prisma.workerTrigger.create({
    data: {
      action: "behavioral-email-analysis",
      source: "manual",
    },
  });

  return NextResponse.json({ ok: true });
}
