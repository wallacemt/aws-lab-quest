import { METRICS_TOOLS } from "./metrics";
import { USERS_TOOLS } from "./users";
import type { AdminToolDef } from "./types";

export const ADMIN_TOOL_CATALOG: AdminToolDef[] = [...USERS_TOOLS, ...METRICS_TOOLS];

export function getToolsForScopes(scopes: string[]): AdminToolDef[] {
  return ADMIN_TOOL_CATALOG.filter((tool) => {
    if (tool.tier === "read") return scopes.includes(`${tool.domain}:read`);
    if (tool.tier === "write") return scopes.includes(`${tool.domain}:write`);
    return scopes.includes(`${tool.domain}:write`) && scopes.includes("danger");
  });
}
