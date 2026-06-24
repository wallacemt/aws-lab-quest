import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { LibraryContentType } from "@prisma/client";

const VALID_TYPES = new Set<LibraryContentType>(["PDF", "IMAGE", "MARKDOWN", "SLIDES"]);

/**
 * Validates that a URL uses only http or https scheme, blocking javascript:
 * and other potentially dangerous URI schemes from being stored and reflected.
 */
function isValidAuthorUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/library
 * Returns all library content (published and unpublished), newest first.
 *
 * POST /api/admin/library
 * Creates a new LibraryContent row.
 */

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const items = await prisma.libraryContent.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ content: items });
}

type CreateBody = {
  type?: string;
  title?: string;
  description?: string;
  category?: string;
  certificationPresetId?: string;
  awsServiceId?: string;
  questChainId?: string;
  bodyMarkdown?: string;
  authorName?: string;
  authorUrl?: string;
  authorContact?: string;
  published?: boolean;
};

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const body = (await request.json()) as CreateBody;

  if (!body.type || !VALID_TYPES.has(body.type as LibraryContentType)) {
    return NextResponse.json(
      { error: "type deve ser PDF, IMAGE, MARKDOWN ou SLIDES." },
      { status: 400 },
    );
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title é obrigatório." }, { status: 400 });
  }
  if (!body.category?.trim()) {
    return NextResponse.json({ error: "category é obrigatória." }, { status: 400 });
  }
  if (!body.authorName?.trim()) {
    return NextResponse.json({ error: "authorName é obrigatório." }, { status: 400 });
  }
  if (body.authorUrl && !isValidAuthorUrl(body.authorUrl)) {
    return NextResponse.json(
      { error: "authorUrl must be a valid http/https URL" },
      { status: 400 },
    );
  }

  const item = await prisma.libraryContent.create({
    data: {
      type: body.type as LibraryContentType,
      title: body.title.trim(),
      description: body.description?.trim() ?? null,
      category: body.category.trim(),
      certificationPresetId: body.certificationPresetId ?? null,
      awsServiceId: body.awsServiceId ?? null,
      questChainId: body.questChainId ?? null,
      bodyMarkdown: body.bodyMarkdown ?? null,
      authorName: body.authorName.trim(),
      authorUrl: body.authorUrl?.trim() ?? null,
      authorContact: body.authorContact?.trim() ?? null,
      published: body.published ?? false,
      createdByUserId: adminCheck.userId,
    },
  });

  return NextResponse.json({ content: item }, { status: 201 });
}
