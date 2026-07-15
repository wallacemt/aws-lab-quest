import crypto from "crypto";
import { supabase } from "@/lib/supabase";

export const ACHIEVEMENT_ARTWORK_BUCKET = "aws-lab-quest";
export const ACHIEVEMENT_ARTWORK_PREFIX = "achievements";

const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isDataUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.startsWith("data:") && DATA_URL_REGEX.test(value);
}

export function isSupabaseAchievementArtworkUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.includes(`/storage/v1/object/public/${ACHIEVEMENT_ARTWORK_BUCKET}/${ACHIEVEMENT_ARTWORK_PREFIX}/`);
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } {
  const match = DATA_URL_REGEX.exec(dataUrl);
  if (!match) throw new Error("Data URL invalida.");
  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s/g, "");
  const ext = EXT_BY_MIME[mimeType] ?? "jpg";
  const buffer = Buffer.from(base64, "base64");
  return { buffer, mimeType, ext };
}

function buildArtworkPath(ext: string, achievementId?: string | null): string {
  const id = crypto.randomUUID();
  const folder = achievementId ? `${ACHIEVEMENT_ARTWORK_PREFIX}/${achievementId}` : `${ACHIEVEMENT_ARTWORK_PREFIX}/orphan`;
  return `${folder}/${Date.now()}-${id}.${ext}`;
}

export async function uploadAchievementArtworkDataUrl(dataUrl: string, achievementId?: string | null): Promise<string> {
  const { buffer, mimeType, ext } = parseDataUrl(dataUrl);
  const path = buildArtworkPath(ext, achievementId);

  const { error: uploadError } = await supabase.storage
    .from(ACHIEVEMENT_ARTWORK_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    throw new Error(`Falha ao subir arte para o Supabase: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(ACHIEVEMENT_ARTWORK_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function extractAchievementArtworkPath(url: string): string | null {
  if (!isSupabaseAchievementArtworkUrl(url)) return null;
  const marker = `/storage/v1/object/public/${ACHIEVEMENT_ARTWORK_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0];
  if (!path.startsWith(`${ACHIEVEMENT_ARTWORK_PREFIX}/`)) return null;
  return path;
}

export async function deleteAchievementArtworkFromSupabase(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const path = extractAchievementArtworkPath(url);
  if (!path) return;

  const { error } = await supabase.storage.from(ACHIEVEMENT_ARTWORK_BUCKET).remove([path]);
  if (error) {
    console.warn(`Falha ao remover arte do Supabase (${path}): ${error.message}`);
  }
}

export async function resolveAchievementArtworkForStorage(
  artworkUrl: string | null | undefined,
  achievementId?: string | null,
): Promise<string | null> {
  if (!artworkUrl) return null;
  if (isDataUrl(artworkUrl)) {
    return uploadAchievementArtworkDataUrl(artworkUrl, achievementId);
  }
  return artworkUrl;
}
