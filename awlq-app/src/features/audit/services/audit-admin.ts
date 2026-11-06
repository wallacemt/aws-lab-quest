import type { AuditCatalogTool, AuditFilters, AuditPage } from "@/features/audit/types";

export async function getAuditEvents(filters: AuditFilters, cursor?: string): Promise<AuditPage> {
  const params = new URLSearchParams({ limit: "50" });
  const apiFilters = resolveAuditDateFilters(filters);
  for (const [key, value] of Object.entries(apiFilters)) if (value && key !== "period" && key !== "tokenName") params.set(key, value);
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/admin/audit?${params}`, { credentials: "include" });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Não foi possível carregar os eventos.");
  return response.json() as Promise<AuditPage>;
}

export function resolveAuditDateFilters(filters: AuditFilters, now = new Date()): AuditFilters {
  if (!filters.period) return { ...filters, from: filters.from ?? new Date(now.getTime() - 7 * 86400000).toISOString() };
  if (filters.period === "custom") return filters;
  const days = filters.period === "24h" ? 1 : filters.period === "30d" ? 30 : filters.period === "90d" ? 90 : 7;
  return { ...filters, from: filters.from ?? new Date(now.getTime() - days * 86400000).toISOString(), to: filters.to ?? (filters.period === "24h" ? now.toISOString() : undefined) };
}

export async function getAuditCatalog(): Promise<AuditCatalogTool[]> {
  const response = await fetch("/api/admin/mcp/catalog", { credentials: "include" });
  if (!response.ok) throw new Error("Catálogo indisponível");
  const body = await response.json() as { tools?: AuditCatalogTool[] };
  return body.tools ?? [];
}

export function mergeAuditPages(pages: AuditPage[]): AuditPage {
  const seen = new Set<string>();
  const items = pages.flatMap((page) => page.items).filter((event) => !seen.has(event.id) && Boolean(seen.add(event.id)));
  return { items, nextCursor: pages.at(-1)?.nextCursor ?? null };
}

export function groupAuditEventsByDay(items: AuditPage["items"], now = new Date()): Array<{ key: string; label: string; items: AuditPage["items"] }> {
  const groups = new Map<string, AuditPage["items"]>();
  for (const event of items) {
    const date = new Date(event.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return [...groups].map(([key, events]) => {
    const date = new Date(events[0].createdAt);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const label = day === today ? "HOJE" : day === today - 86400000 ? "ONTEM" : new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "").toUpperCase();
    return { key, label: `${label} · ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "").toUpperCase()}`, items: events };
  });
}

export function readAuditFilters(search: string): AuditFilters {
  const params = new URLSearchParams(search);
  const result: AuditFilters = {};
  for (const key of ["actorType", "domain", "action", "tool", "status", "from", "to", "q", "tokenId", "actorUserId"] as const) {
    const value = params.get(key);
    if (value) result[key] = value;
  }
  return result;
}

export function writeAuditFilters(filters: AuditFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && key !== "period" && key !== "tokenName") params.set(key, value);
  return params.toString();
}
