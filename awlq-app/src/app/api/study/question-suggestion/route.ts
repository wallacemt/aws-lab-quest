import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  serviceCode?: string;
  serviceName?: string;
  difficulty?: string;
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;

  if (!body.serviceCode || !body.difficulty) {
    return NextResponse.json({ error: "serviceCode e difficulty sao obrigatorios." }, { status: 400 });
  }

  await prisma.workerTrigger.create({
    data: {
      action: "QUESTION_SUGGESTION",
      source: "manual",
      payload: {
        userId: session.user.id,
        userEmail: session.user.email,
        serviceCode: body.serviceCode,
        serviceName: body.serviceName ?? body.serviceCode,
        difficulty: body.difficulty,
      },
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
