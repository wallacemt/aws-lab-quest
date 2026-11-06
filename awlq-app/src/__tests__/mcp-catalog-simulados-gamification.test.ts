import { describe, expect, it } from "vitest";

import { ADMIN_TOOL_CATALOG } from "@/features/mcp/server/catalog";
import { GAMIFICATION_TOOLS } from "@/features/mcp/server/catalog/gamification";
import { SIMULADOS_TOOLS } from "@/features/mcp/server/catalog/simulados";

describe("MCP simulados and gamification catalogs", () => {
  it("has unique names and exposes exactly the specified routes", () => {
    const names = ADMIN_TOOL_CATALOG.map(({ name }) => name);
    expect(names.length).toBe(new Set(names).size);
    expect(SIMULADOS_TOOLS.map(({ name }) => name)).toEqual([
      "simulado_packs_list", "simulado_pack_get", "simulado_generate_status", "simulado_generate_auto_status",
      "simulado_artwork_migration_status", "simulado_pack_create", "simulado_pack_update", "simulado_generate",
      "simulado_generate_auto", "simulado_pack_generate_artwork", "simulado_pack_delete", "simulado_artwork_migrate",
    ]);
    expect(GAMIFICATION_TOOLS.map(({ name }) => name)).toEqual([
      "achievements_list", "achievement_get", "achievement_create", "achievement_update", "achievement_suggest",
      "achievement_generate_artwork", "achievement_delete", "bosses_list", "boss_get", "boss_create", "boss_update",
      "boss_suggest", "boss_generate_artwork", "boss_delete", "themes_list", "theme_update", "theme_delete",
      "weekly_challenges_list", "weekly_challenge_get", "weekly_challenge_update", "weekly_challenge_suggest",
      "weekly_challenge_trigger", "weekly_challenge_pause",
    ]);
    expect(ADMIN_TOOL_CATALOG.map(({ path }) => path)).not.toContain("simulado-packs/[packId]/signed-url");
  });

  it("rejects fields outside strict schemas", () => {
    const create = SIMULADOS_TOOLS.find(({ name }) => name === "simulado_pack_create")!;
    const update = GAMIFICATION_TOOLS.find(({ name }) => name === "weekly_challenge_update")!;
    expect(create.inputSchema.safeParse({ name: "Pack", certificationCode: "CLF", questionIds: [], extra: true }).success).toBe(false);
    expect(update.inputSchema.safeParse({ challengeId: "c1", active: true, extra: true }).success).toBe(false);
  });

  it("resolves lazy route handlers for representative tools", async () => {
    // Route imports initialize real singletons at module load time.
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.SUPABASE_URL ??= "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    for (const catalog of [SIMULADOS_TOOLS, GAMIFICATION_TOOLS]) {
      for (const tool of catalog) expect(typeof await tool.handler()).toBe("function");
    }
  }, 90000);
});
