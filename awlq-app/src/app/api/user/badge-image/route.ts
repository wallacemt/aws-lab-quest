import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyImageMagicBytes } from "@/lib/input-validation";
import { supabase } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Imagem deve ser JPEG, PNG ou WebP." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem deve ter no maximo 4 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // LSF-2026-007: verify actual file content via magic bytes — do not trust client MIME type
  const detectedMime = verifyImageMagicBytes(buffer);
  if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
    return NextResponse.json({ error: "Conteudo do arquivo nao corresponde a uma imagem valida." }, { status: 400 });
  }

  const ext = EXT_MAP[detectedMime] ?? "png";
  const path = `cert-badges/${session.user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("aws-lab-quest")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    // LSF-2026-009: do not reflect storage provider error details to client
    console.error("[badge-image] Supabase upload error:", uploadError.message);
    return NextResponse.json({ error: "Upload falhou. Tente novamente." }, { status: 502 });
  }

  const { data } = supabase.storage.from("aws-lab-quest").getPublicUrl(path);

  return NextResponse.json({ imageUrl: data.publicUrl });
}
