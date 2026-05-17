import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { AI_CONTEXTS, AiContext, loadAllAiConfigs, saveAiConfig } from "@/lib/ai-config";

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const configs = await loadAllAiConfigs();
  return NextResponse.json({ configs });
}

type PatchBody = {
  context: AiContext;
  model: string;
  apiKey?: string;
};

export async function PATCH(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body || !body.context || !body.model) {
    return NextResponse.json({ error: "context e model sao obrigatorios" }, { status: 400 });
  }

  if (!AI_CONTEXTS.includes(body.context)) {
    return NextResponse.json({ error: `context invalido: ${body.context}` }, { status: 400 });
  }

  if (!body.apiKey) {
    return NextResponse.json({ error: "apiKey obrigatoria" }, { status: 400 });
  }

  await saveAiConfig(body.context, body.model.trim(), body.apiKey.trim());

  return NextResponse.json({ ok: true });
}
