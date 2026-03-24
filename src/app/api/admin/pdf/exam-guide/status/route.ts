import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const certifications = await prisma.certificationPreset.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      updatedAt: true,
      examGuide: true,
    },
  });

  const guideUploads = await prisma.adminUploadedFile.findMany({
    where: { uploadType: "EXAM_GUIDE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      certificationPresetId: true,
      uploadedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const latestByCertification = new Map<string, (typeof guideUploads)[number]>();
  for (const upload of guideUploads) {
    if (!upload.certificationPresetId || latestByCertification.has(upload.certificationPresetId)) {
      continue;
    }

    latestByCertification.set(upload.certificationPresetId, upload);
  }

  return NextResponse.json({
    certifications: certifications.map((certification) => {
      const latestUpload = latestByCertification.get(certification.id) ?? null;
      return {
        id: certification.id,
        code: certification.code,
        name: certification.name,
        hasExamGuide: Boolean(certification.examGuide && certification.examGuide.trim().length > 0),
        updatedAt: certification.updatedAt,
        latestUpload,
      };
    }),
  });
}
