"use client";

import { useMemo } from "react";
import { Skull } from "lucide-react";
import { ActorBadge } from "@/features/audit/components/ActorBadge";
import { StatusChip } from "@/features/audit/components/StatusChip";
import { groupAuditEventsByDay } from "@/features/audit/services/audit-admin";
import type { AuditCatalogTool, AuditEventDTO } from "@/features/audit/types";

export function AuditEventRow({ events, selectedId, catalog, onSelect, rowRefs }: { events: AuditEventDTO[]; selectedId?: string; catalog: AuditCatalogTool[]; onSelect: (event: AuditEventDTO) => void; rowRefs: React.MutableRefObject<Map<string, HTMLButtonElement>> }) {
  const groups = useMemo(() => groupAuditEventsByDay(events), [events]);
  return <div className="overflow-hidden" aria-busy="false"><div className="hidden grid-cols-[72px_220px_104px_minmax(180px,1fr)_112px_104px_48px_64px] gap-2 bg-[var(--pixel-muted)] px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-subtext)] xl:grid" aria-hidden="true"><span>Hora</span><span>Ator</span><span>Domínio</span><span>Ação</span><span>Recurso</span><span>Status</span><span>HTTP</span><span>Duração</span></div>
    {groups.map((group) => <section key={group.key}><h3 className="sticky top-0 z-10 bg-[var(--pixel-muted)] px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-subtext)]">{group.label}</h3><ol>{group.items.map((event) => {
      const agent = event.actorType === "agent";
      const tool = catalog.find((item) => item.name === event.tool);
      const date = new Date(event.createdAt);
      const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
      const title = tool?.title ?? event.tool;
      const action = agent ? title ?? event.action : `${event.action.split(" ")[0]} ${event.path}`;
      const identity = agent ? event.tokenName ?? "Token removido" : event.actorEmail;
      const label = `${agent ? "Agente IA, token" : "Humano"} ${identity}, ${action}, domínio ${event.domain}, status ${event.status}, ${time}`;
      const duration = event.durationMs === null ? "—" : event.durationMs >= 1000 ? `${(event.durationMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : `${event.durationMs} ms`;
      return <li key={event.id} className="border-b border-[var(--pixel-muted)]"><button ref={(node) => { if (node) rowRefs.current.set(event.id, node); else rowRefs.current.delete(event.id); }} onClick={() => onSelect(event)} aria-label={label} aria-pressed={selectedId === event.id} className={`relative flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-[var(--pixel-text)] hover:bg-[var(--pixel-muted)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pixel-text)] ${selectedId === event.id ? "border-l-2 border-[var(--pixel-primary)]" : ""}`}>
        {agent && <span aria-hidden className="agent-rail absolute inset-y-0 left-0 w-1.5" />}
        <time dateTime={event.createdAt} title={date.toLocaleString("pt-BR")} className="hidden w-[72px] shrink-0 font-code text-xs tabular-nums text-[var(--pixel-subtext)] xl:block">{time}</time>
        <span className="hidden w-[220px] shrink-0 items-center gap-2 overflow-hidden xl:flex"><ActorBadge actorType={event.actorType} /><span className="truncate font-reading text-sm">{identity}</span></span>
        <span className="hidden w-[104px] shrink-0 truncate font-code text-xs xl:block">{event.domain}</span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2 xl:hidden"><ActorBadge actorType={event.actorType} /><span className="truncate font-reading text-sm">{action}</span>{tool?.tier === "danger" && <Skull size={14} />}</span><span className="hidden truncate font-reading text-sm xl:block">{action}{tool?.tier === "danger" && <Skull className="ml-2 inline" size={14} />}</span><span className="mt-1 block truncate font-reading text-xs text-[var(--pixel-subtext)] xl:hidden">{identity} · {event.domain} · {time}</span></span>
        <span className="hidden w-[112px] truncate font-code text-xs xl:block" title={event.resourceId ?? undefined}>{event.resourceId ? `${event.resourceId.slice(0, 5)}…${event.resourceId.slice(-3)}` : "—"}</span>
        <span className="shrink-0"><StatusChip status={event.status} /></span><span className="hidden w-12 text-right font-code text-xs tabular-nums text-[var(--pixel-subtext)] xl:block">{event.httpStatus ?? "—"}</span><span className="hidden w-16 text-right font-code text-xs tabular-nums text-[var(--pixel-subtext)] xl:block">{duration}</span>
      </button></li>;
    })}</ol></section>)}
  </div>;
}
