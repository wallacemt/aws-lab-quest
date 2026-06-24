import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { requireApprovedUser } from "@/lib/user-auth";

const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * GET /api/library/[contentId]
 *
 * Returns a single published LibraryContent item. When the item has a
 * storagePath (PDF, IMAGE, SLIDES), a signed URL valid for one hour is
 * generated and included in the response. The access counter is incremented
 * atomically inside the same update call.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const { response } = await requireApprovedUser(request);
  if (response) return response;

  const { contentId } = await params;

  // Increment accessCount and fetch the row in one round-trip.
  let content;
  try {
    content = await prisma.libraryContent.update({
      where: { id: contentId, published: true },
      data: { accessCount: { increment: 1 } },
    });
  } catch (err) {
    // Prisma P2025 — record not found (or not published)
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
    }
    throw err;
  }

  let signedUrl: string | undefined;
  if (content.storageBucket && content.storagePath) {
    const { data, error } = await supabase.storage
      .from(content.storageBucket)
      .createSignedUrl(content.storagePath, SIGNED_URL_TTL_SECONDS);

    if (!error && data?.signedUrl) {
      signedUrl = data.signedUrl;
    } else {
      console.error("[library] createSignedUrl failed:", error?.message);
    }
  }

  return NextResponse.json({ content, signedUrl });
}
