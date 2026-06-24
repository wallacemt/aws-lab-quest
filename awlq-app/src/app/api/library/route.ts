import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/user-auth";
import type { LibraryContentLite } from "@/features/library/types";

/**
 * GET /api/library
 *
 * Returns published library content, optionally filtered by category,
 * AWS service code, or quest chain id.
 *
 * Query params:
 *   category?     — match LibraryContent.category
 *   serviceCode?  — match LibraryContent.awsServiceId
 *   chainId?      — match LibraryContent.questChainId
 */
export async function GET(request: NextRequest) {
  const { response } = await requireApprovedUser(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const serviceCode = searchParams.get("serviceCode") ?? undefined;
  const chainId = searchParams.get("chainId") ?? undefined;

  const items = await prisma.libraryContent.findMany({
    where: {
      published: true,
      ...(category ? { category } : {}),
      ...(serviceCode ? { awsServiceId: serviceCode } : {}),
      ...(chainId ? { questChainId: chainId } : {}),
    },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      category: true,
      authorName: true,
      accessCount: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const content: LibraryContentLite[] = items;

  return NextResponse.json({ content });
}
