import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{
    fileId: string;
  }>;
};

function parseTtl(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 180;
  }

  return Math.max(30, Math.min(600, Math.round(value)));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { fileId } = await context.params;
  const ttlSeconds = parseTtl(request.nextUrl.searchParams.get("ttl"));

  const uploadedFile = await prisma.adminUploadedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      fileName: true,
      storageBucket: true,
      storagePath: true,
      uploadType: true,
      createdAt: true,
    },
  });

  if (!uploadedFile) {
    return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 });
  }

  const signed = await supabase.storage
    .from(uploadedFile.storageBucket)
    .createSignedUrl(uploadedFile.storagePath, ttlSeconds, {
      download: uploadedFile.fileName,
    });

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      {
        error: signed.error?.message ?? "Falha ao gerar URL assinada.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    file: uploadedFile,
    signedUrl: signed.data.signedUrl,
    expiresInSeconds: ttlSeconds,
  });
}
