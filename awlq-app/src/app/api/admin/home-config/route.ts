import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ALL_APP_MODES } from "@/features/utils/home-apps";
import { publishHomeConfigUpdatedEvent } from "@/lib/realtime-events";

const CONFIG_KEY = "home_config";

export type AppEntry = { id: string; enabled: boolean; order: number; highlighted: boolean };
export type HomeConfig = { apps: AppEntry[] };

function buildDefault(): HomeConfig {
  return {
    apps: ALL_APP_MODES.map((m, i) => ({ id: m.id, enabled: true, order: i, highlighted: false })),
  };
}

// GET is public — the config data is not sensitive and is needed by the home screen and the route guard.
export async function GET() {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
    if (!row) return NextResponse.json(buildDefault());
    return NextResponse.json(JSON.parse(row.value) as HomeConfig);
  } catch {
    // Fail open: return default so the app is never broken by a missing config
    return NextResponse.json(buildDefault());
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  try {
    const body = (await request.json()) as HomeConfig;
    if (!Array.isArray(body?.apps)) {
      return NextResponse.json({ error: "apps deve ser um array" }, { status: 400 });
    }
    const value = JSON.stringify(body);
    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value },
      update: { value },
    });
    void publishHomeConfigUpdatedEvent();
    return NextResponse.json(body);
  } catch (error) {
    console.error("PATCH /api/admin/home-config error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
