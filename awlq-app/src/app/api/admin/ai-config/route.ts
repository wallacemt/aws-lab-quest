import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { AI_CONTEXTS, AiContext, loadAllAiConfigs, saveAiConfig, saveOpenRouterKey } from "@/lib/ai-config";

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const { configs, maskedKey } = await loadAllAiConfigs();
  return NextResponse.json({ configs, maskedKey });
}

type KeyPatch = { type: "key"; apiKey: string };
type ModelPatch = { type: "model"; context: AiContext; model: string };
type PatchBody = KeyPatch | ModelPatch;

export async function PATCH(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body || !body.type) {
    return NextResponse.json({ error: "body.type obrigatorio (\"key\" ou \"model\")" }, { status: 400 });
  }

  if (body.type === "key") {
    if (!body.apiKey?.trim()) {
      return NextResponse.json({ error: "apiKey obrigatoria" }, { status: 400 });
    }
    await saveOpenRouterKey(body.apiKey.trim());
    return NextResponse.json({ ok: true });
  }

  if (body.type === "model") {
    if (!body.context || !body.model?.trim()) {
      return NextResponse.json({ error: "context e model obrigatorios" }, { status: 400 });
    }
    if (!AI_CONTEXTS.includes(body.context)) {
      return NextResponse.json({ error: `context invalido: ${body.context}` }, { status: 400 });
    }
    await saveAiConfig(body.context, body.model.trim());
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "type invalido" }, { status: 400 });
}
