import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteAdminUploadedFileById } from "@/lib/admin-ingestion";
import { devAuditLog } from "@/lib/dev-audit";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { fileId } = await context.params;

  try {
    const removed = await deleteAdminUploadedFileById(fileId);

    devAuditLog("admin.uploads.deleted", {
      adminUserId: adminCheck.userId,
      fileId: removed.id,
      fileName: removed.fileName,
      storagePath: removed.storagePath,
    });

    return NextResponse.json({ ok: true, fileId: removed.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao remover upload.";

    devAuditLog("admin.uploads.delete.failed", {
      adminUserId: adminCheck.userId,
      fileId,
      error: message,
    });

    return NextResponse.json({ error: message }, { status: 422 });
  }
}
