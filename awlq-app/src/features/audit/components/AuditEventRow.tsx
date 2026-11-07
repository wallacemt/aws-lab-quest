"use client";

import { useEffect, useMemo, useState } from "react";
import { Columns3, Skull } from "lucide-react";
import { ActorBadge } from "@/features/audit/components/ActorBadge";
import { StatusChip } from "@/features/audit/components/StatusChip";
import { groupAuditEventsByDay } from "@/features/audit/services/audit-admin";
import type { AuditCatalogTool, AuditEventDTO } from "@/features/audit/types";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PixelButton } from "@/components/ui/pixel-button";

const columnOptions = ["Hora", "Ator", "Domínio", "Ação", "Recurso", "Status", "HTTP", "Duração"] as const;
type Column = typeof columnOptions[number];
const defaultColumns: Column[] = [...columnOptions];
const storageKey = "admin-audit-visible-columns";

export function AuditEventRow({ events, selectedId, catalog, onSelect, rowRefs }: { events: AuditEventDTO[]; selectedId?: string; catalog: AuditCatalogTool[]; onSelect: (event: AuditEventDTO) => void; rowRefs: React.MutableRefObject<Map<string, HTMLButtonElement>> }) {
  const groups = useMemo(() => groupAuditEventsByDay(events), [events]);
  const [visibleColumns, setVisibleColumns] = useState<Column[]>(defaultColumns);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(stored)) {
        const valid = stored.filter((column): column is Column => columnOptions.includes(column));
        if (valid.length) setVisibleColumns(valid);
      }
    } catch { /* Ignore invalid or unavailable browser storage. */ }
  }, []);
  const toggleColumn = (column: Column, checked: boolean) => {
    const next = checked ? [...visibleColumns, column] : visibleColumns.filter((item) => item !== column);
    if (next.length === 0) return;
    setVisibleColumns(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current selection for this page. */ }
  };
  const widths: Record<Column, string> = { Hora: "minmax(150px,1.2fr)", Ator: "minmax(170px,1.5fr)", Domínio: "minmax(100px,.8fr)", Ação: "minmax(180px,2fr)", Recurso: "minmax(110px,1fr)", Status: "minmax(100px,.8fr)", HTTP: "minmax(64px,.5fr)", Duração: "minmax(80px,.7fr)" };
  const grid = visibleColumns.map((column) => widths[column]).join(" ");
  return <div className="overflow-hidden border border-[var(--pixel-muted)]" aria-busy="false">
    <div className="flex items-center justify-between gap-3 border-b border-[var(--pixel-muted)] bg-[var(--pixel-muted)] px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-subtext)]">Eventos de auditoria</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><PixelButton variant="ghost" className="px-2 py-1 text-[10px]"><Columns3 size={14} /> Colunas</PixelButton></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 border border-[var(--pixel-muted)] bg-[var(--pixel-card)] text-[var(--pixel-text)]">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase">Colunas visíveis</DropdownMenuLabel>
          {columnOptions.map((column) => <DropdownMenuCheckboxItem key={column} checked={visibleColumns.includes(column)} disabled={visibleColumns.length === 1 && visibleColumns.includes(column)} onCheckedChange={(checked) => toggleColumn(column, checked)}>{column}</DropdownMenuCheckboxItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="sticky top-0 z-10 hidden gap-2 bg-[var(--pixel-muted)] px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-subtext)] xl:grid" style={{ gridTemplateColumns: grid }} aria-hidden="true">{visibleColumns.map((column) => <span key={column}>{column}</span>)}</div>
    {groups.map((group) => <section key={group.key}><h3 className="sticky top-0 z-10 bg-[var(--pixel-muted)] px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-subtext)]">{group.label}</h3><ol>{group.items.map((event) => {
      const agent = event.actorType === "agent";
      const tool = catalog.find((item) => item.name === event.tool);
      const date = new Date(event.createdAt);
      const time = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }).format(date);
      const title = tool?.title ?? event.tool;
      const action = agent ? title ?? event.action : `${event.action.split(" ")[0]} ${event.path}`;
      const identity = agent ? event.tokenName ?? "Token removido" : event.actorEmail;
      const label = `${agent ? "Agente IA, token" : "Humano"} ${identity}, ${action}, domínio ${event.domain}, status ${event.status}, ${time}`;
      const duration = event.durationMs === null ? "—" : event.durationMs >= 1000 ? `${(event.durationMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : `${event.durationMs} ms`;
      const cells: Record<Column, React.ReactNode> = {
        Hora: <time dateTime={event.createdAt} title={date.toLocaleString("pt-BR")} className="font-code text-xs tabular-nums text-[var(--pixel-subtext)]">{time}</time>,
        Ator: <span className="flex min-w-0 items-center gap-2"><ActorBadge actorType={event.actorType} /><span className="truncate font-reading text-sm">{identity}</span></span>,
        Domínio: <span className="truncate font-code text-xs">{event.domain}</span>,
        Ação: <span className="flex min-w-0 items-center gap-2 truncate font-reading text-sm">{action}{tool?.tier === "danger" && <Skull size={14} />}</span>,
        Recurso: <span className="truncate font-code text-xs" title={event.resourceId ?? undefined}>{event.resourceId ? `${event.resourceId.slice(0, 5)}…${event.resourceId.slice(-3)}` : "—"}</span>,
        Status: <StatusChip status={event.status} />,
        HTTP: <span className="text-right font-code text-xs tabular-nums text-[var(--pixel-subtext)]">{event.httpStatus ?? "—"}</span>,
        Duração: <span className="text-right font-code text-xs tabular-nums text-[var(--pixel-subtext)]">{duration}</span>,
      };
      return <li key={event.id} className="border-b border-[var(--pixel-muted)]"><button ref={(node) => { if (node) rowRefs.current.set(event.id, node); else rowRefs.current.delete(event.id); }} onClick={() => onSelect(event)} aria-label={label} aria-pressed={selectedId === event.id} className={`relative w-full px-3 py-2 text-left text-[var(--pixel-text)] hover:bg-[var(--pixel-muted)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pixel-text)] ${selectedId === event.id ? "border-l-2 border-[var(--pixel-primary)]" : ""}`}>
        {agent && <span aria-hidden className="agent-rail absolute inset-y-0 left-0 w-1.5" />}
        <span className="flex items-center gap-2 xl:hidden"><ActorBadge actorType={event.actorType} /><span className="min-w-0 flex-1 truncate font-reading text-sm">{action}</span><StatusChip status={event.status} /></span>
        <span className="mt-1 block truncate font-reading text-xs text-[var(--pixel-subtext)] xl:hidden">{identity} · {event.domain} · {time}</span>
        <span className="hidden items-center gap-2 xl:grid" style={{ gridTemplateColumns: grid }}>{visibleColumns.map((column) => <span key={column} className="min-w-0">{cells[column]}</span>)}</span>
      </button></li>;
    })}</ol></section>)}
  </div>;
}
