import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      accessStatus: true,
      active: true,
      accessDecisionAt: true,
      accessDecisionReason: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    role: user.role,
    accessStatus: user.accessStatus,
    active: user.active,
    accessDecisionAt: user.accessDecisionAt,
    accessDecisionReason: user.accessDecisionReason,
  });
}
