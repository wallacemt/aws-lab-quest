import { supabase } from "@/lib/supabase";

const BUCKET = "aws-lab-quest";
// Signed URL TTL: 1 hour. Callers may cache the resulting URL until it expires.
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Returns a signed URL for a Supabase storage path.
 *
 * Accepts either:
 *   - A bare storage path  (e.g. "avatars/user-id/1234.jpg")
 *   - A full public URL    (legacy format stored before bucket was made private)
 *
 * Returns null when the input is null/undefined OR when URL signing fails.
 * This is intentionally fail-closed: callers must substitute a generic
 * placeholder (e.g. "/default-avatar.png") rather than falling back to the
 * original path or a public URL — doing so would defeat the purpose of
 * keeping the storage bucket private.
 *
 * TODO: once the bucket is confirmed private in the Supabase dashboard,
 * remove the legacy public-URL extraction path in extractStoragePath().
 */
export async function getSignedAvatarUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;

  const storagePath = extractStoragePath(pathOrUrl);
  // Unrecognized format — cannot sign, fail closed.
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    // Signing failed (expired credentials, object not found, etc.).
    // Return null so callers show a generic placeholder instead of leaking
    // the storage path or a public URL.
    console.error("[storage-url] createSignedUrl failed:", error?.message ?? "no signedUrl returned");
    return null;
  }

  return data.signedUrl;
}

/**
 * Extracts the storage path from either a bare path or a Supabase public URL.
 * Returns null if the string doesn't match either known format.
 */
function extractStoragePath(pathOrUrl: string): string | null {
  // Already a bare path (no protocol)
  if (!pathOrUrl.startsWith("http")) {
    return pathOrUrl;
  }

  // Supabase public URL pattern:
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const PUBLIC_URL_PATTERN = /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/;
  const match = PUBLIC_URL_PATTERN.exec(pathOrUrl);
  return match ? match[1]! : null;
}
