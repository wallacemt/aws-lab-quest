import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const MODELS_URL = "https://openrouter.ai/api/v1/models";

type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt: string; completion: string };
};

/**
 * GET /api/admin/openrouter-models
 *
 * Proxies OpenRouter's live model catalog and returns only models priced at
 * zero (prompt + completion), so the admin picker always reflects what's
 * actually free right now instead of a hardcoded list that goes stale as
 * OpenRouter adds/removes free models.
 */
export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  try {
    const res = await fetch(MODELS_URL);
    if (!res.ok) {
      throw new Error(`OpenRouter respondeu ${res.status} ${res.statusText}`);
    }

    const { data } = (await res.json()) as { data: OpenRouterModel[] };
    const models = data
      .filter((m) => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
      .map((m) => ({
        id: m.id,
        name: m.name,
        context: m.context_length ? `${Math.round(m.context_length / 1000)}k` : "?",
        desc: m.description?.slice(0, 140) ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar modelos da OpenRouter.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
