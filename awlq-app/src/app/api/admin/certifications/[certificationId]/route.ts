import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { invalidateCertificationsCache } from "@/lib/certification-service";

type RouteContext = { params: Promise<{ certificationId: string }> };

async function findLatestExamGuideUpload(certificationId: string) {
  return prisma.adminUploadedFile.findFirst({
    where: { certificationPresetId: certificationId, uploadType: "EXAM_GUIDE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      uploadedBy: { select: { name: true, email: true } },
    },
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { certificationId } = await params;

  const certification = await prisma.certificationPreset.findUnique({
    where: { id: certificationId },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      examMinutes: true,
      active: true,
      displayOrder: true,
      examGuide: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { questions: true, userProfiles: true } },
    },
  });

  if (!certification) {
    return NextResponse.json({ error: "Certificacao nao encontrada." }, { status: 404 });
  }

  const latestExamGuideUpload = await findLatestExamGuideUpload(certification.id);
  const { examGuide, ...cert } = certification;

  return NextResponse.json({
    ...cert,
    hasExamGuide: Boolean(examGuide && examGuide.trim().length > 0),
    latestExamGuideUpload,
  });
}

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { certificationId } = await params;

  let body: {
    name?: string;
    description?: string;
    examMinutes?: number;
    active?: boolean;
    displayOrder?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const existing = await prisma.certificationPreset.findUnique({ where: { id: certificationId } });
  if (!existing) {
    return NextResponse.json({ error: "Certificacao nao encontrada." }, { status: 404 });
  }

  const data: {
    name?: string;
    description?: string;
    examMinutes?: number;
    active?: boolean;
    displayOrder?: number;
  } = {};

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `Nome deve ter entre 1 e ${MAX_NAME_LENGTH} caracteres.` }, { status: 422 });
    }
    data.name = trimmed;
  }

  if (body.description !== undefined) {
    const trimmed = body.description.trim();
    if (!trimmed || trimmed.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Descricao deve ter entre 1 e ${MAX_DESCRIPTION_LENGTH} caracteres.` },
        { status: 422 },
      );
    }
    data.description = trimmed;
  }

  if (body.examMinutes !== undefined) {
    if (!Number.isFinite(body.examMinutes) || body.examMinutes <= 0) {
      return NextResponse.json({ error: "examMinutes deve ser um numero maior que 0." }, { status: 422 });
    }
    data.examMinutes = Math.floor(body.examMinutes);
  }

  if (body.active !== undefined) data.active = Boolean(body.active);

  if (body.displayOrder !== undefined) {
    if (!Number.isFinite(body.displayOrder)) {
      return NextResponse.json({ error: "displayOrder deve ser um numero." }, { status: 422 });
    }
    data.displayOrder = Math.floor(body.displayOrder);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const certification = await prisma.certificationPreset.update({
    where: { id: certificationId },
    data,
  });

  // The public /api/certifications listing is cached — invalidate so name/active/
  // displayOrder edits are visible immediately instead of waiting out the TTL.
  await invalidateCertificationsCache();

  return NextResponse.json({ certification });
}
