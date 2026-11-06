import { NextRequest, NextResponse } from "next/server";
import { requireHumanAdmin } from "@/lib/admin-auth";
import { MCP_SCOPES } from "@/features/mcp/scopes";

export async function GET(request: NextRequest) {
  const check = await requireHumanAdmin(request);
  if (!check.ok) return check.response;
  return NextResponse.json({ scopes: MCP_SCOPES, tools: [] });
}
