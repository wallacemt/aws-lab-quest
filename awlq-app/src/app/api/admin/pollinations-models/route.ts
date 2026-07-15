import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const MODELS_URL = "https://gen.pollinations.ai/models";

type PollinationsModel = {
  name: string;
  title?: string;
  description?: string;
  category: string;
};

/**
 * GET /api/admin/pollinations-models
 *
 * Proxies Pollinations' combined model catalog and returns only the image
 * models, for the artwork-generation model picker (AiArtworkGenerator).
 */
export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const res = await fetch(MODELS_URL);
    if (!res.ok) {
      throw new Error(`Pollinations respondeu ${res.status} ${res.statusText}`);
    }

    const all = (await res.json()) as PollinationsModel[];
    const models = all
      .filter((m) => m.category === "image")
      .map((m) => ({ name: m.name, title: m.title ?? m.name, description: m.description ?? null }));

    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar modelos do Pollinations.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
