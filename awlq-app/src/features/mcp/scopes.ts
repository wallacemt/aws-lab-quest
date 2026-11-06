export type McpDomain = "users" | "questions" | "ingestion" | "simulados" | "gamification" | "content" | "email" | "ops" | "metrics";
export type McpScope = `${McpDomain}:read` | `${Exclude<McpDomain, "metrics">}:write` | "danger";

const DOMAINS: Array<{ id: McpDomain; label: string }> = [
  { id: "users", label: "Usuários" },
  { id: "questions", label: "Questões" },
  { id: "ingestion", label: "Ingestão" },
  { id: "simulados", label: "Simulados" },
  { id: "gamification", label: "Gamificação" },
  { id: "content", label: "Conteúdo" },
  { id: "email", label: "E-mail" },
  { id: "ops", label: "Operações" },
  { id: "metrics", label: "Métricas" },
];

export const MCP_SCOPES: { id: McpScope; domain: McpDomain | null; action: "read" | "write" | "danger"; label: string }[] = DOMAINS.flatMap(({ id, label }) => [
  { id: `${id}:read` as McpScope, domain: id, action: "read" as const, label: `${label} — leitura` },
  ...(id === "metrics" ? [] : [{ id: `${id}:write` as McpScope, domain: id, action: "write" as const, label: `${label} — escrita` }]),
]);
MCP_SCOPES.push({ id: "danger", domain: null, action: "danger", label: "Ações perigosas (danger)" });

const scopeIds = new Set<string>(MCP_SCOPES.map(({ id }) => id));
export function isValidScope(value: string): value is McpScope {
  return scopeIds.has(value);
}
