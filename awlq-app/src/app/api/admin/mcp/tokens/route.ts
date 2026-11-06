import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/features/audit/server/with-admin-audit";
import { z } from "zod";
import { requireHumanAdmin } from "@/lib/admin-auth";
import { isValidScope } from "@/features/mcp/scopes";
import { generateToken, InvalidTokenScopesError, listTokensForOwner, TokenLimitExceededError } from "@/features/mcp/server/token-service";

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(60),
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]),
  scopes: z.array(z.string().refine(isValidScope)).min(1),
});
export async function GET(request: NextRequest) {
  const check = await requireHumanAdmin(request);
  if (!check.ok) return check.response;
  return NextResponse.json({ tokens: await listTokensForOwner() });
}
export const POST = withAdminAudit("mcp/tokens", async (request: NextRequest) => {
  const check = await requireHumanAdmin(request);
  if (!check.ok) return check.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 }); }
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  try {
    const generated = await generateToken({ ...parsed.data, userId: check.userId });
    const { secret, ...token } = generated;
    return NextResponse.json({ token, secret }, { status: 201 });
  } catch (error) {
    if (error instanceof TokenLimitExceededError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof InvalidTokenScopesError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
