import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyImageMagicBytes } from "@/lib/input-validation";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { getSignedAvatarUrl } from "@/lib/storage-url";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No avatar file provided." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be JPEG, PNG, WebP or GIF." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 5 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // LSF-2026-007: verify actual file content via magic bytes — do not trust client MIME type
  const detectedMime = verifyImageMagicBytes(buffer);
  if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
    return NextResponse.json({ error: "File content does not match an allowed image type." }, { status: 400 });
  }

  const ext = EXT_MAP[detectedMime] ?? "png";
  const path = `avatars/${session.user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("aws-lab-quest")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    // LSF-2026-009: do not reflect storage provider error details to client
    console.error("[upload-avatar] Supabase upload error:", uploadError.message);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }

  // Store the bare storage path so we can generate signed URLs at read time.
  // TODO: convert bucket to private in the Supabase dashboard after deploy.
  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, avatarUrl: path },
    update: { avatarUrl: path },
  });

  const signedUrl = await getSignedAvatarUrl(path);
  // Signed URL is best-effort at upload time; the client will re-fetch it
  // via /api/user/profile when the page loads. Return the bare path as a
  // non-sensitive fallback only within this upload response (never public URL).
  return NextResponse.json({ avatarUrl: signedUrl ?? path });
}
