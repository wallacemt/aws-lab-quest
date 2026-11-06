import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminRequestContext } from "@/lib/admin-request-context";

type AdminCheckResult =
  | {
      ok: true;
      userId: string;
      email: string;
      role: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireAdmin(request: NextRequest): Promise<AdminCheckResult> {
  const context = getAdminRequestContext();
  const hasReservedHeader = ["X-AWLQ-Actor", "X-AWLQ-Mcp-Token-Id", "X-AWLQ-Request-Id"]
    .some((name) => request.headers.has(name));

  if (hasReservedHeader && !context?.principal) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Cabecalho reservado" }, { status: 400 }),
    };
  }

  if (context?.principal) {
    const user = await prisma.user.findUnique({
      where: { id: context.principal.userId },
      select: { id: true, email: true, role: true, active: true },
    });

    if (!user || !user.active || user.role !== "admin") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    context.actor = { userId: user.id, email: user.email };
    return { ok: true, userId: user.id, email: user.email, role: "admin" };
  }

  return requireSessionAdmin(request, context);
}

export async function requireHumanAdmin(request: NextRequest): Promise<AdminCheckResult> {
  const context = getAdminRequestContext();
  if (context?.principal) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return requireSessionAdmin(request, context);
}

async function requireSessionAdmin(
  request: NextRequest,
  context: ReturnType<typeof getAdminRequestContext>,
): Promise<AdminCheckResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, active: true },
  });

  if (!user || !user.active || user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (context) context.actor = { userId: user.id, email: user.email };
  return {
    ok: true,
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}
