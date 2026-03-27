import { createHash } from "node:crypto";
import { AdminIngestionStatus, AdminUploadType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

const ADMIN_UPLOADS_BUCKET = "aws-lab-quest";

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function buildSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function uploadAdminFileToSupabase(input: {
  fileName: string;
  certificationCode: string;
  uploadType: AdminUploadType;
  buffer: Buffer;
  mimeType: string;
}) {
  const now = new Date();
  const safeFileName = sanitizeFileName(input.fileName || "document.pdf");
  const key = [
    input.uploadType.toLowerCase(),
    input.certificationCode.toLowerCase(),
    `${now.getUTCFullYear()}`,
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    `${now.getTime()}-${safeFileName}`,
  ].join("/");

  const upload = await supabase.storage.from(ADMIN_UPLOADS_BUCKET).upload(key, input.buffer, {
    contentType: input.mimeType,
    upsert: false,
  });

  if (upload.error) {
    throw new Error(`Falha ao enviar arquivo para storage: ${upload.error.message}`);
  }

  return {
    bucket: ADMIN_UPLOADS_BUCKET,
    path: key,
  };
}

export async function removeAdminFileFromSupabase(input: { bucket: string; path: string }): Promise<void> {
  const remove = await supabase.storage.from(input.bucket).remove([input.path]);
  if (remove.error) {
    throw new Error(`Falha ao remover arquivo do storage: ${remove.error.message}`);
  }
}

export async function deleteAdminUploadedFileById(fileId: string): Promise<{
  id: string;
  fileName: string;
  storageBucket: string;
  storagePath: string;
}> {
  const file = await prisma.adminUploadedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      fileName: true,
      storageBucket: true,
      storagePath: true,
    },
  });

  if (!file) {
    throw new Error("Arquivo nao encontrado para remocao.");
  }

  try {
    await removeAdminFileFromSupabase({
      bucket: file.storageBucket,
      path: file.storagePath,
    });
  } catch {
    // Continue with DB cleanup even if storage object is already missing.
  }

  await prisma.adminUploadedFile.delete({ where: { id: file.id } });

  return file;
}

export async function createUploadedFileRecord(input: {
  uploadType: AdminUploadType;
  certificationPresetId?: string | null;
  uploadedByUserId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageBucket: string;
  storagePath: string;
  sha256: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.adminUploadedFile.create({
    data: {
      uploadType: input.uploadType,
      certificationPresetId: input.certificationPresetId ?? null,
      uploadedByUserId: input.uploadedByUserId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      sha256: input.sha256,
      source: "admin",
      metadata: input.metadata,
    },
  });
}

export async function createIngestionJob(input: {
  uploadType: AdminUploadType;
  createdByUserId: string;
  certificationPresetId?: string | null;
  status?: AdminIngestionStatus;
  progressPercent?: number;
  message?: string;
  desiredCount?: number;
  fileName?: string;
}) {
  return prisma.adminIngestionJob.create({
    data: {
      uploadType: input.uploadType,
      createdByUserId: input.createdByUserId,
      certificationPresetId: input.certificationPresetId ?? null,
      status: input.status ?? "PENDING",
      progressPercent: input.progressPercent ?? 0,
      message: input.message ?? null,
      desiredCount: input.desiredCount,
      fileName: input.fileName,
      startedAt: new Date(),
    },
  });
}

export async function updateIngestionJob(
  jobId: string,
  data: {
    status?: AdminIngestionStatus;
    progressPercent?: number;
    message?: string | null;
    generatedCount?: number;
    savedCount?: number;
    errorMessage?: string | null;
    uploadedFileId?: string | null;
    finished?: boolean;
  },
) {
  return prisma.adminIngestionJob.update({
    where: { id: jobId },
    data: {
      status: data.status,
      progressPercent: data.progressPercent,
      message: data.message,
      generatedCount: data.generatedCount,
      savedCount: data.savedCount,
      errorMessage: data.errorMessage,
      uploadedFileId: data.uploadedFileId,
      finishedAt: data.finished ? new Date() : undefined,
    },
  });
}
