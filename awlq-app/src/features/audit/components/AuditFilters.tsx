"use client";

import { useEffect, useState } from "react";
import { Bot, Search, User, SlidersHorizontal, X } from "lucide-react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelSegmented } from "@/components/ui/pixel-segmented";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { AuditCatalogTool, AuditFilters as Filters } from "@/features/audit/types";

const domains = [["users", "Usuários"], ["questions", "Questões"], ["ingestion", "Ingestão"], ["simulados", "Simulados"], ["gamification", "Gamificação"], ["content", "Conteúdo"], ["email", "E-mail"], ["ops", "Operações"], ["metrics", "Métricas"], ["platform", "Plataforma"]] as const;
const statuses = [["ok", "OK"], ["error", "Erro"], ["denied", "Negado"], ["rate_limited", "Limite"], ["pending", "Pendente"]];

export function AuditFilters({ filters, catalog, onChange }: { filters: Filters; catalog: AuditCatalogTool[]; onChange: (filters: Filters) => void }) {
  const [search, setSearch] = useState(filters.q ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search.length === 0 || search.length >= 2) onChange({ ...filters, q: search || undefined });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, filters, onChange]);

  const set = (key: keyof Filters, value?: string) => onChange({ ...filters, [key]: value || undefined });
  const controls = (current: Filters, update: (key: keyof Filters, value?: string) => void) => <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    <label className="space-y-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Período
      <select className="h-11 w-full border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] px-2 font-reading text-sm text-[var(--pixel-text)]" value={current.from && current.to ? "custom" : "7d"} onChange={(e) => { const value = e.target.value; if (value === "custom") update("period", "custom"); else if (value === "7d") { update("from", undefined); update("to", undefined); update("period", undefined); } else { const days = value === "24h" ? 1 : value === "30d" ? 30 : 90; const now = new Date(); const from = new Date(now.getTime() - days * 86400000); update("from", from.toISOString()); update("to", value === "24h" ? now.toISOString() : undefined); update("period", value); } }}>
        <option value="24h">24 horas</option><option value="7d">7 dias</option><option value="30d">30 dias</option><option value="90d">90 dias</option><option value="custom">Personalizado</option>
      </select>
    </label>
    <label className="space-y-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Domínio
      <select className="h-11 w-full border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] px-2 font-reading text-sm text-[var(--pixel-text)]" value={current.domain ?? ""} onChange={(e) => update("domain", e.target.value)}><option value="">Todos</option>{domains.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
    </label>
    <label className="space-y-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Ação / tool
      <input
        list="audit-tools"
        value={current.tool ?? current.action ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          const found = catalog.some((tool) => tool.name === value);
          update("tool", found ? value : undefined);
          update("action", found ? undefined : value);
        }}
        className="h-11 w-full border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] px-2 font-code text-sm text-[var(--pixel-text)]"
      />
      <datalist id="audit-tools">{catalog.map((tool) => <option key={tool.name} value={tool.name}>{tool.title}</option>)}</datalist>
    </label>
    <label className="space-y-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Status
      <select className="h-11 w-full border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] px-2 font-reading text-sm text-[var(--pixel-text)]" value={current.status ?? ""} onChange={(e) => update("status", e.target.value)}><option value="">Todos</option>{statuses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
    </label>
    {current.period === "custom" && <div className="grid grid-cols-2 gap-2 md:col-span-2"><label className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">De<input type="date" className="mt-1 h-11 w-full border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] p-2 text-[var(--pixel-text)]" value={current.from?.slice(0, 10) ?? ""} onChange={(e) => update("from", e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined)} /></label><label className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Até<input type="date" className="mt-1 h-11 w-full border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] p-2 text-[var(--pixel-text)]" value={current.to?.slice(0, 10) ?? ""} onChange={(e) => update("to", e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined)} /></label></div>}
  </div>;
  const active = Object.entries(filters).filter(([key, value]) => value && !["period", "tokenName"].includes(key));
  const filterCount = active.filter(([key]) => !["actorType", "q", "tokenId", "actorUserId"].includes(key)).length;
  return <PixelCard className="space-y-3 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-4 md:p-6">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <label className="flex h-11 items-center gap-2 border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] px-3 text-[var(--pixel-subtext)]"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => { if (search.length === 0 || search.length >= 2) onChange({ ...filters, q: search || undefined }); }} placeholder="Buscar ação, caminho, tool, recurso, e-mail ou erro" className="min-w-0 flex-1 bg-transparent font-reading text-sm text-[var(--pixel-text)] outline-none placeholder:text-[var(--pixel-subtext)]" /></label>
        {search.length === 1 && <p className="mt-1 font-reading text-xs text-[var(--pixel-subtext)]">Digite pelo menos 2 caracteres</p>}
      </div>
      <PixelSegmented legend="Ator" value={filters.actorType ?? "all"} onChange={(v) => set("actorType", v === "all" ? undefined : v)} options={[{ value: "all", label: "TODOS" }, { value: "human", label: "HUMANO", icon: <User size={12} /> }, { value: "agent", label: "AGENTE IA", icon: <Bot size={12} /> }]} />
    </div>
    <div className="hidden md:block">{controls(filters, set)}</div>
    <div className="md:hidden"><PixelButton variant="ghost" onClick={() => setMobileOpen(true)}><SlidersHorizontal size={14} /> FILTROS ({filterCount})</PixelButton></div>
    {active.length > 0 && <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">{active.map(([key, value]) => <button key={key} onClick={() => set(key as keyof Filters, undefined)} className="inline-flex min-h-11 items-center gap-1 border border-[var(--admin-control-border)] px-2 font-reading text-xs text-[var(--pixel-text)]">{key === "tokenId" ? `Token: ${filters.tokenName ?? value.slice(0, 12)}` : key === "actorUserId" ? "Admin" : `${key}: ${value}`} <X size={12} /></button>)}<button onClick={() => { setSearch(""); onChange({}); }} className="min-h-11 px-2 font-mono text-[10px] text-[var(--pixel-primary)]">LIMPAR</button></div>}
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="bottom" className="border-t-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] text-[var(--pixel-text)]"><SheetTitle className="font-mono text-xs uppercase">Filtros</SheetTitle>{controls(draft, (key, value) => setDraft((old) => ({ ...old, [key]: value })))}<PixelButton onClick={() => { onChange(draft); setMobileOpen(false); }}>APLICAR</PixelButton></SheetContent></Sheet>
  </PixelCard>;
}
