import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueUsername, isValidUsername, normalizeUsername } from "@/lib/username";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("value");
  if (!query) {
    return NextResponse.json({ available: false, error: "Informe um username para validar." }, { status: 400 });
  }

  const username = normalizeUsername(query).toLowerCase();
  if (!isValidUsername(username)) {
    return NextResponse.json({ available: false, error: "Formato invalido." }, { status: 200 });
  }

  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  return NextResponse.json({ available: !existing, username });
}

export async function POST(request: NextRequest) {
  const auth = await requireApprovedUser(request);
  if (auth.response) return auth.response;

  const body = (await request.json()) as { username?: string; random?: boolean };
  let username = normalizeUsername(body.username ?? "").toLowerCase();

  if (body.random || !username) {
    username = await generateUniqueUsername();
  }

  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Nome de usuario invalido." }, { status: 400 });
  }

  const owner = await prisma.user.findFirst({
    where: { username, NOT: { id: auth.user.id } },
    select: { id: true },
  });

  if (owner) {
    return NextResponse.json({ error: "Nome de usuario indisponivel." }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: { username, lastSeen: new Date() },
    select: { username: true },
  });

  return NextResponse.json({ username: user.username });
}
