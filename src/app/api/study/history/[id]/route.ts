import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const historyId = params.id?.trim();

  if (!historyId) {
    return NextResponse.json({ error: "ID de historico invalido." }, { status: 400 });
  }

  const item = await prisma.studySessionHistory.findFirst({
    where: {
      id: historyId,
      userId: session.user.id,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Sessao de estudo nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ item });
}
