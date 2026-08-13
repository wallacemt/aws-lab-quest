import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

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
