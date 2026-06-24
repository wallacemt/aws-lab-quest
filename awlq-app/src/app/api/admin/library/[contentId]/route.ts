import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
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

type Params = Promise<{ contentId: string }>;

/**
 * GET /api/admin/library/[contentId]
 * Returns one item regardless of published state.
 *
 * PUT /api/admin/library/[contentId]
 * Updates any mutable fields on the item.
 *
 * DELETE /api/admin/library/[contentId]
 * Deletes the item. Also removes the file from Supabase Storage when
 * storagePath is set.
 */

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { contentId } = await params;

  const item = await prisma.libraryContent.findUnique({ where: { id: contentId } });
  if (!item) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ content: item });
}

type UpdateBody = {
  type?: string;
  title?: string;
  description?: string | null;
  category?: string;
  certificationPresetId?: string | null;
  awsServiceId?: string | null;
  questChainId?: string | null;
  bodyMarkdown?: string | null;
  authorName?: string;
  authorUrl?: string | null;
  authorContact?: string | null;
  published?: boolean;
};

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { contentId } = await params;
  const body = (await request.json()) as UpdateBody;

  if (body.type !== undefined && !VALID_TYPES.has(body.type as LibraryContentType)) {
    return NextResponse.json(
      { error: "type deve ser PDF, IMAGE, MARKDOWN ou SLIDES." },
      { status: 400 },
    );
  }
  if (body.authorUrl != null && body.authorUrl !== "" && !isValidAuthorUrl(body.authorUrl)) {
    return NextResponse.json(
      { error: "authorUrl must be a valid http/https URL" },
      { status: 400 },
    );
  }

  let item;
  try {
    item = await prisma.libraryContent.update({
      where: { id: contentId },
      data: {
        ...(body.type !== undefined ? { type: body.type as LibraryContentType } : {}),
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.category !== undefined ? { category: body.category.trim() } : {}),
        ...(body.certificationPresetId !== undefined
          ? { certificationPresetId: body.certificationPresetId }
          : {}),
        ...(body.awsServiceId !== undefined ? { awsServiceId: body.awsServiceId } : {}),
        ...(body.questChainId !== undefined ? { questChainId: body.questChainId } : {}),
        ...(body.bodyMarkdown !== undefined ? { bodyMarkdown: body.bodyMarkdown } : {}),
        ...(body.authorName !== undefined ? { authorName: body.authorName.trim() } : {}),
        ...(body.authorUrl !== undefined ? { authorUrl: body.authorUrl } : {}),
        ...(body.authorContact !== undefined ? { authorContact: body.authorContact } : {}),
        ...(body.published !== undefined ? { published: body.published } : {}),
      },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({ content: item });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { contentId } = await params;

  let item;
  try {
    item = await prisma.libraryContent.delete({ where: { id: contentId } });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
    }
    throw err;
  }

  // Best-effort storage cleanup — don't block the 200 response on storage errors.
  if (item.storageBucket && item.storagePath) {
    try {
      await supabase.storage.from(item.storageBucket).remove([item.storagePath]);
    } catch (storageErr) {
      console.error("[library] storage cleanup failed:", storageErr);
    }
  }

  return NextResponse.json({ deleted: true });
}
