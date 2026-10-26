import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { invalidateCertificationsCache } from "@/lib/certification-service";

// ponytail: no pagination — a handful of certifications exist today (one findMany
// screen-fits). Add skip/take here (and in the client) if the catalog grows past that.
export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const certifications = await prisma.certificationPreset.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      examMinutes: true,
      passingScorePercent: true,
      active: true,
      displayOrder: true,
      examGuide: true,
      updatedAt: true,
      _count: { select: { questions: true, userProfiles: true } },
    },
  });

  return NextResponse.json({
    items: certifications.map(({ examGuide, ...cert }) => ({
      ...cert,
      hasExamGuide: Boolean(examGuide && examGuide.trim().length > 0),
    })),
  });
}

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  let body: { code?: unknown; name?: unknown; description?: unknown; examMinutes?: unknown; passingScorePercent?: unknown; displayOrder?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!code) return NextResponse.json({ error: "Codigo e obrigatorio." }, { status: 422 });
  if (!name || name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: `Nome deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres.` }, { status: 422 });
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) return NextResponse.json({ error: `Descricao deve ter entre 1 e ${MAX_DESCRIPTION_LENGTH} caracteres.` }, { status: 422 });
  if (body.examMinutes !== undefined && (!Number.isInteger(body.examMinutes) || (body.examMinutes as number) <= 0)) return NextResponse.json({ error: "Duracao deve ser um numero inteiro maior que 0." }, { status: 422 });
  if (body.passingScorePercent !== undefined && (!Number.isInteger(body.passingScorePercent) || (body.passingScorePercent as number) < 1 || (body.passingScorePercent as number) > 100)) return NextResponse.json({ error: "Nota de corte deve ser um numero inteiro entre 1 e 100." }, { status: 422 });
  if (body.displayOrder !== undefined && !Number.isInteger(body.displayOrder)) return NextResponse.json({ error: "Ordem de exibicao deve ser um numero inteiro." }, { status: 422 });

  const existing = await prisma.certificationPreset.findUnique({ where: { code }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Ja existe uma certificacao com esse codigo." }, { status: 409 });
  const highest = body.displayOrder === undefined ? await prisma.certificationPreset.aggregate({ _max: { displayOrder: true } }) : null;
  try {
    const certification = await prisma.certificationPreset.create({
      data: { code, name, description, examMinutes: body.examMinutes as number | undefined, passingScorePercent: body.passingScorePercent as number | undefined, displayOrder: (body.displayOrder as number | undefined) ?? ((highest?._max.displayOrder ?? -1) + 1), active: true },
      select: { id: true, code: true, name: true, description: true, examMinutes: true, passingScorePercent: true, active: true, displayOrder: true, updatedAt: true, _count: { select: { questions: true, userProfiles: true } } },
    });
    await invalidateCertificationsCache();
    return NextResponse.json({ certification: { ...certification, hasExamGuide: false } }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Ja existe uma certificacao com esse codigo." }, { status: 409 });
    throw error;
  }
}
