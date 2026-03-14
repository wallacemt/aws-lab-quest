import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const services = await prisma.awsService.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
    },
  });

  return NextResponse.json({ services });
}
