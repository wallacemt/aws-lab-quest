"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ScrollText } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditEventDetail } from "@/features/audit/components/AuditEventDetail";
import { AuditEventRow } from "@/features/audit/components/AuditEventRow";
import { AuditFilters } from "@/features/audit/components/AuditFilters";
import { getAuditCatalog, getAuditEvents, mergeAuditPages, readAuditFilters, resolveAuditDateFilters, writeAuditFilters } from "@/features/audit/services/audit-admin";
import type { AuditCatalogTool, AuditEventDTO, AuditFilters as Filters, AuditPage } from "@/features/audit/types";

export function AdminLogsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const filters = useMemo(() => readAuditFilters(query), [query]);
  const [pages, setPages] = useState<AuditPage[]>([]);
  const [catalog, setCatalog] = useState<AuditCatalogTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditEventDTO | null>(null);
  const [loadedQuery, setLoadedQuery] = useState("");
  const refreshing = pages.length > 0 && loadedQuery !== query;
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const events = useMemo(() => mergeAuditPages(pages).items, [pages]);
  const nextCursor = pages.at(-1)?.nextCursor ?? null;

  const updateFilters = useCallback((next: Filters) => {
    const encoded = writeAuditFilters(next);
    router.replace(`${pathname}${encoded ? `?${encoded}` : ""}`, { scroll: false });
  }, [pathname, router]);

  useEffect(() => { getAuditCatalog().then(setCatalog).catch(() => setCatalog([])); }, []);
  useEffect(() => {
    let active = true;
    getAuditEvents(resolveAuditDateFilters(filters)).then((page) => { if (active) { setPages([page]); setError(""); setLoadedQuery(query); } }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Não foi possível carregar os eventos."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // URL is the canonical source of filter state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError("");
    try {
      const page = await getAuditEvents(resolveAuditDateFilters(filters), nextCursor);
      setPages((current) => [...current, page]);
      requestAnimationFrame(() => { const newId = page.items[0]?.id; if (newId) rowRefs.current.get(newId)?.focus(); });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar os eventos."); }
    finally { setLoadingMore(false); }
  };
  const navigateEvent = (event: AuditEventDTO) => setSelected(event);
  const period = filters.from && filters.to ? `${filters.from.slice(0, 10)} a ${filters.to.slice(0, 10)}` : "últimos 7 dias";

  return <main className="admin-console min-h-full space-y-6 p-4 text-[var(--pixel-text)] md:p-6">
    <header><p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-primary)]">LOGS</p><h1 className="mt-2 font-reading text-xl font-semibold">Auditoria administrativa</h1></header>
    <AuditFilters filters={filters} catalog={catalog} onChange={updateFilters} />
    {refreshing && <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">CARREGANDO…</span>}
    {error && <div role="alert" className="border-2 border-[var(--pixel-danger)] p-4 font-reading text-sm">Não foi possível carregar os eventos. <span>{error}</span> <PixelButton variant="danger" onClick={() => { setLoading(true); setError(""); const encoded = writeAuditFilters(filters); router.replace(`${pathname}${encoded ? `?${encoded}` : ""}`); }}>TENTAR DE NOVO</PixelButton></div>}
    {loading && pages.length === 0 ? <div aria-busy="true" className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div> : events.length === 0 && !error ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><ScrollText size={32} className="text-[var(--pixel-subtext)]"/><h2 className="font-mono text-xs uppercase">{Object.keys(filters).length ? "NENHUM EVENTO NO PERÍODO" : "NADA REGISTRADO AINDA"}</h2><p className="max-w-md font-reading text-sm text-[var(--pixel-subtext)]">{Object.keys(filters).length ? `Nenhum evento corresponde aos filtros entre ${period}.` : "Ações feitas pelo painel e pelo agente de IA aparecem aqui."}</p>{Object.keys(filters).length > 0 && <PixelButton variant="ghost" onClick={() => updateFilters({})}>LIMPAR FILTROS</PixelButton>}</div> : events.length > 0 && <div className={refreshing ? "opacity-60" : ""}><AuditEventRow events={events} selectedId={selected?.id} catalog={catalog} onSelect={setSelected} rowRefs={rowRefs} /></div>}
    {events.length > 0 && (nextCursor ? <div className="pt-4 text-center"><PixelButton variant="ghost" disabled={loadingMore} className="w-full md:w-auto" onClick={loadMore}>{loadingMore && <Loader2 size={14} className="animate-spin"/>}{loadingMore ? "CARREGANDO…" : "CARREGAR MAIS ▼"}</PixelButton><p aria-live="polite" className="sr-only">{loadingMore ? "Carregando eventos" : ""}</p></div> : <div className="space-y-2 pt-4 text-center"><p className="font-mono text-[10px] text-[var(--pixel-subtext)]">— FIM DO REGISTRO —</p><p className="font-reading text-xs text-[var(--pixel-subtext)]">Período: {period}</p></div>)}
    <AuditEventDetail event={selected} events={events} catalog={catalog} onClose={() => { setSelected(null); if (selected) rowRefs.current.get(selected.id)?.focus(); }} onNavigate={navigateEvent} onFilterToken={(tokenId) => { setSelected(null); updateFilters({ ...filters, actorType: "agent", tokenId }); }} />
  </main>;
}
