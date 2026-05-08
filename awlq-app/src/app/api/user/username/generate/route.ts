import { prisma } from "@/lib/prisma";
import { generateUniqueUsername, isValidUsername } from "@/lib/username";
import { NextResponse } from "next/server";

export async function GET() {
  const username = await generateUniqueUsername();
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Nome de usuario invalido." }, { status: 400 });
  }

  if (await prisma.user.findFirst({ where: { username: username } })) {
    return NextResponse.json({ error: "Nome de usuario em uso" }, { status: 409 });
  }
  return NextResponse.json({ username: username });
}
