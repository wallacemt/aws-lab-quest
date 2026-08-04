import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      lastSeen: new Date(),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
