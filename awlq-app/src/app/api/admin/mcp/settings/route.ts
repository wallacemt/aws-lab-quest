import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/features/audit/server/with-admin-audit";
import { requireHumanAdmin } from "@/lib/admin-auth";
import { getPdfUrlAllowlist, isMcpEnabled, setMcpEnabled, setPdfUrlAllowlist } from "@/features/mcp/server/settings-service";

async function settings() {
  const [enabled, pdfUrlAllowlist] = await Promise.all([isMcpEnabled(), getPdfUrlAllowlist()]);
  return { enabled, endpointUrl: `${process.env.APP_URL}/api/mcp`, pdfUrlAllowlist };
}
export async function GET(request: NextRequest) {
  const check = await requireHumanAdmin(request);
  if (!check.ok) return check.response;
  return NextResponse.json(await settings());
}
export const PATCH = withAdminAudit("mcp/settings", async (request: NextRequest) => {
  const check = await requireHumanAdmin(request);
  if (!check.ok) return check.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "O body deve ser um objeto." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if ("enabled" in input && typeof input.enabled !== "boolean") return NextResponse.json({ error: "enabled deve ser boolean." }, { status: 400 });
  if ("pdfUrlAllowlist" in input && !Array.isArray(input.pdfUrlAllowlist)) return NextResponse.json({ error: "pdfUrlAllowlist deve ser uma lista." }, { status: 400 });
  try {
    if ("enabled" in input) await setMcpEnabled(input.enabled as boolean);
    if ("pdfUrlAllowlist" in input) await setPdfUrlAllowlist(input.pdfUrlAllowlist as string[]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Allowlist inválida." }, { status: 400 });
  }
  return NextResponse.json(await settings());
});
