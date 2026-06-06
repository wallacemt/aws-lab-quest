import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import type { LibraryContentType } from "@prisma/client";

const LIBRARY_BUCKET = "awslq-library-content";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * MIME types permitted per content type.
 * SVG is intentionally excluded from IMAGE because it can embed JavaScript.
 * MARKDOWN content is delivered via the bodyMarkdown field, not file upload.
 */
const ALLOWED_MIME: Record<LibraryContentType, string[]> = {
  PDF: ["application/pdf"],
  SLIDES: [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  IMAGE: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  MARKDOWN: [],
};

type Params = Promise<{ contentId: string }>;

/**
 * POST /api/admin/library/[contentId]/upload
 *
 * Accepts multipart/form-data with a "file" field.
 * Validates file size and MIME type against the content's declared type
 * before uploading to Supabase Storage. MARKDOWN content types reject
 * file uploads entirely (use the bodyMarkdown field instead).
 *
 * Returns: { storagePath, storageBucket }
 */
export async function POST(request: NextRequest, { params }: { params: Params }) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const { contentId } = await params;

  // Fetch the content row to get its declared type for MIME validation.
  const content = await prisma.libraryContent.findUnique({
    where: { id: contentId },
    select: { id: true, type: true },
  });
  if (!content) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  if (content.type === "MARKDOWN") {
    return NextResponse.json(
      { error: "MARKDOWN content does not support file uploads. Use the bodyMarkdown field instead." },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Campo 'file' obrigatório." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo excede o limite de 50 MB." }, { status: 413 });
  }

  const allowed = ALLOWED_MIME[content.type] ?? [];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: `File type ${file.type} is not allowed for content type ${content.type}` },
      { status: 415 },
    );
  }

  const safeFileName = sanitizeFileName(file.name);
  const storagePath = `${contentId}/${safeFileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(LIBRARY_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    console.error("[library-upload] storage upload failed:", uploadError.message);
    return NextResponse.json(
      { error: `Falha ao enviar arquivo: ${uploadError.message}` },
      { status: 502 },
    );
  }

  await prisma.libraryContent.update({
    where: { id: contentId },
    data: { storagePath, storageBucket: LIBRARY_BUCKET },
  });

  return NextResponse.json({ storagePath, storageBucket: LIBRARY_BUCKET });
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
