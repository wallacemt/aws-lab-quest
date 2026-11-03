import { NextRequest, NextResponse } from "next/server";
import { requireHumanAdmin } from "@/lib/admin-auth";
import { revokeToken, TokenNotFoundError } from "@/features/mcp/server/token-service";

export async function DELETE(request: NextRequest, context: { params: Promise<{ tokenId: string }> }) {
  const check = await requireHumanAdmin(request);
  if (!check.ok) return check.response;
  const { tokenId } = await context.params;
  try { return NextResponse.json(await revokeToken(tokenId, check.userId)); }
  catch (error) {
    if (error instanceof TokenNotFoundError) return NextResponse.json({ error: "Token não encontrado." }, { status: 404 });
    throw error;
  }
}
