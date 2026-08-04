import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

type Body = {
  serviceCode?: string;
  serviceName?: string;
  difficulty?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const body = (await request.json()) as Body;

  if (!body.serviceCode || !body.difficulty) {
    return NextResponse.json({ error: "serviceCode e difficulty sao obrigatorios." }, { status: 400 });
  }

  await prisma.workerTrigger.create({
    data: {
      action: "QUESTION_SUGGESTION",
      source: "manual",
      payload: {
        userId: auth.user.id,
        userEmail: auth.user.email,
        serviceCode: body.serviceCode,
        serviceName: body.serviceName ?? body.serviceCode,
        difficulty: body.difficulty,
      },
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
