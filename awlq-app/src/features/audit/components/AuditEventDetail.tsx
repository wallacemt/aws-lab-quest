"use client";

import { useEffect } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ActorBadge } from "@/features/audit/components/ActorBadge";
import { StatusChip } from "@/features/audit/components/StatusChip";
import type { AuditCatalogTool, AuditEventDTO } from "@/features/audit/types";

export function AuditEventDetail({ event, events, catalog, onClose, onNavigate, onFilterToken }: { event: AuditEventDTO | null; events: AuditEventDTO[]; catalog: AuditCatalogTool[]; onClose: () => void; onNavigate: (event: AuditEventDTO) => void; onFilterToken: (tokenId: string) => void }) {
  const index = events.findIndex((item) => item.id === event?.id);
  useEffect(() => {
    if (!event) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft" && index > 0) onNavigate(events[index - 1]);
      if (e.key === "ArrowRight" && index >= 0 && index < events.length - 1) onNavigate(events[index + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [event, events, index, onNavigate]);
  const tool = event?.tool ? catalog.find((item) => item.name === event.tool) : undefined;
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); };
  const args = event?.argsRedacted;
  const truncated = Boolean(args && typeof args === "object" && "truncated" in args && (args as { truncated?: boolean }).truncated);
  return <Sheet open={Boolean(event)} onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent className="w-full overflow-hidden bg-[var(--pixel-card)] p-0 text-[var(--pixel-text)] shadow-[-6px_0_0_0_var(--pixel-shadow)] sm:max-w-xl">
    {event && <><header className="border-b-2 border-[var(--pixel-muted)] p-4"><div className="flex flex-wrap items-center gap-2"><ActorBadge actorType={event.actorType} /><StatusChip status={event.status} /></div><SheetTitle className="mt-3 font-reading text-lg font-semibold">{tool?.title ?? event.tool ?? event.action}</SheetTitle><code className="mt-1 block break-all font-code text-xs text-[var(--pixel-subtext)]">{event.tool ?? event.action}</code><time className="mt-2 block font-reading text-sm text-[var(--pixel-subtext)]" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "medium", timeZoneName: "short" })}</time>{event.errorMessage && <p className="mt-3 border-l-4 border-[var(--pixel-danger)] bg-[var(--admin-inset)] p-3 font-reading text-sm">{event.errorMessage}</p>}</header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4"><section><h3 className="mb-2 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Quem</h3>{event.actorType === "agent" ? <dl className="space-y-1 font-reading text-sm"><div><dt className="inline text-[var(--pixel-subtext)]">Token </dt><dd className="inline">{event.tokenName ?? "Token removido"}</dd></div><div><dt className="inline text-[var(--pixel-subtext)]">Dono </dt><dd className="inline">{event.actorEmail}</dd></div></dl> : <p className="font-reading text-sm">{event.actorEmail}</p>}{event.tokenId && <div className="mt-2 flex flex-wrap gap-2"><a href="/admin/integracoes" className="inline-flex min-h-11 items-center gap-1 font-mono text-[10px] text-[var(--pixel-primary)]">GERENCIAR <ExternalLink size={12} /></a><PixelButton variant="ghost" onClick={() => onFilterToken(event.tokenId!)}>VER TODAS AS AÇÕES DESTE TOKEN</PixelButton></div>}</section>
      <section><h3 className="mb-2 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Requisição</h3><dl className="grid grid-cols-[100px_1fr] gap-y-2 font-reading text-sm"><dt className="text-[var(--pixel-subtext)]">Request ID</dt><dd className="break-all font-code">{event.requestId} <button aria-label="Copiar request ID" onClick={() => copy(event.requestId)}><Copy size={14} /></button></dd><dt className="text-[var(--pixel-subtext)]">Rota</dt><dd className="break-all font-code">{event.action}</dd><dt className="text-[var(--pixel-subtext)]">Caminho</dt><dd className="break-all font-code">{event.path}</dd><dt className="text-[var(--pixel-subtext)]">Recurso</dt><dd className="break-all font-code">{event.resourceId ?? "—"}</dd><dt className="text-[var(--pixel-subtext)]">HTTP</dt><dd className="font-code">{event.httpStatus ?? "—"} · {event.durationMs ?? "—"} ms</dd></dl></section>
      <section><div className="mb-2 flex items-center justify-between"><h3 className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Argumentos (redigidos)</h3>{args != null && <PixelButton variant="ghost" onClick={() => copy(JSON.stringify(args, null, 2))}>COPIAR</PixelButton>}</div><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words bg-[var(--admin-inset)] p-3 font-code text-xs">{args == null ? "Sem argumentos." : truncated ? `Argumentos omitidos: o payload tinha ${((args as { originalSize?: number }).originalSize ?? 0) / 1024} KB e o limite é 4 KB.` : JSON.stringify(args, null, 2)}</pre><p className="mt-2 font-reading text-xs text-[var(--pixel-subtext)]">Senhas, segredos, chaves e HTML são removidos antes de gravar.</p></section>
      <section><h3 className="mb-2 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Origem</h3><dl className="grid grid-cols-[100px_1fr] gap-y-2 font-reading text-sm"><dt className="text-[var(--pixel-subtext)]">IP</dt><dd className="font-code">{event.ip ?? "—"}</dd><dt className="text-[var(--pixel-subtext)]">User agent</dt><dd className="break-all font-code">{event.userAgent ?? "—"}</dd></dl></section></div>
      <footer className="mt-auto flex justify-between border-t-2 border-[var(--pixel-muted)] p-4"><PixelButton variant="ghost" disabled={index <= 0} onClick={() => onNavigate(events[index - 1])}>◀ ANTERIOR</PixelButton><PixelButton variant="ghost" disabled={index < 0 || index >= events.length - 1} onClick={() => onNavigate(events[index + 1])}>PRÓXIMO ▶</PixelButton></footer></>}
  </SheetContent></Sheet>;
}
