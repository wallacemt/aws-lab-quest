"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, AlertCircle, Info, ListMinus, ListPlus, Loader2, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RichText } from "@/components/rich-text/RichText";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ServiceSearchSelect } from "@/features/retention/components/ServiceSearchSelect";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Flashcard, FlashcardInput, createFlashcard, deleteFlashcard, fetchAllFlashcards, queueFlashcard, updateFlashcard,
} from "@/features/retention/services/retention-api";
import { StudyServiceItem, listStudyServices } from "@/features/study/services/study-api";
import { countFlashcards, filterFlashcards, FlashcardCriteria, FlashcardWithPriority, sortFlashcards } from "@/features/retention/lib/flashcard-filters";
import { getFlashcardSourceLabel } from "@/features/retention/lib/flashcard-source-labels";

type Props = { onClose: () => void };
type PanelMode = "read" | "edit" | "create";
const EMPTY_FORM: FlashcardInput = { front: "", back: "", hint: "", awsServiceId: "", topic: "" };
// The management endpoint currently caps this response at the same limit.
const MY_CARDS_LIMIT = 200;
const DEFAULT_CRITERIA: FlashcardCriteria = { query: "", origin: "all", queue: "all", due: "all", awsServiceId: null, sort: "createdDesc" };

function withOverdue(card: Flashcard): FlashcardWithPriority {
  return { ...card, isOverdue: new Date(card.dueAt).getTime() <= Date.now() };
}

function RadioGroup({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{label}</legend>{options.map(([option, text]) => <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 border-2 border-[var(--pixel-border)] px-3 font-mono text-[10px] text-[var(--pixel-text)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--pixel-text)]"><input type="radio" name={label} value={option} checked={value === option} onChange={() => onChange(option)} />{text}</label>)}</fieldset>;
}

function FieldCounter({ id, value, limit }: { id: string; value: string; limit: number }) {
  const closeToLimit = value.length >= limit * 0.9;
  return <p id={id} className="text-right font-mono text-[10px] text-[var(--pixel-subtext)]">{closeToLimit && "QUASE NO LIMITE · "}{value.length} / {limit}</p>;
}

export function FlashcardManager({ onClose }: Props) {
  const [cards, setCards] = useState<FlashcardWithPriority[]>([]);
  const [services, setServices] = useState<StudyServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("read");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FlashcardInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const countRef = useRef<HTMLParagraphElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const selectedCard = cards.find((card) => card.id === selectedId) ?? null;
  const serviceNames = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [{ cards: loadedCards }, loadedServices] = await Promise.all([fetchAllFlashcards(), listStudyServices()]);
      setCards(loadedCards.map(withOverdue));
      setServices(loadedServices);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Erro ao carregar flashcards.");
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (confirmDelete) cancelDeleteRef.current?.focus(); }, [confirmDelete]);

  const filteredCards = useMemo(() => sortFlashcards(filterFlashcards(cards, criteria, serviceNames), criteria.sort), [cards, criteria, serviceNames]);
  const panelFilterCount = Number(criteria.queue !== "all") + Number(criteria.due !== "all") + Number(criteria.awsServiceId !== null);
  const detailOpen = mode === "create" || selectedCard !== null;

  function openCard(card: FlashcardWithPriority) { setSelectedId(card.id); setMode("read"); setConfirmDelete(false); }
  function openCreate() { setSelectedId(null); setForm(EMPTY_FORM); setMode("create"); setConfirmDelete(false); }
  function startEdit() {
    if (!selectedCard || selectedCard.source !== "USER_CREATED") return;
    setForm({ front: selectedCard.front, back: selectedCard.back, hint: selectedCard.hint ?? "", awsServiceId: selectedCard.awsServiceId ?? "", topic: selectedCard.topic ?? "" });
    setMode("edit");
  }
  function closeSheet() { setMode("read"); setSelectedId(null); setConfirmDelete(false); }
  function clearFilters() { setCriteria(DEFAULT_CRITERIA); }

  async function handleQueueToggle(card: Flashcard) {
    setQueueingId(card.id);
    try {
      const { card: updated } = await queueFlashcard(card.id, card.suspended ? "add" : "remove");
      setCards((previous) => previous.map((item) => item.id === updated.id ? withOverdue(updated) : item));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar a esteira.");
    } finally { setQueueingId(null); }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const front = form.front.trim();
    const back = form.back.trim();
    if (!front || !back) { toast.error("Pergunta e resposta são obrigatórias."); return; }
    setSaving(true);
    const payload: FlashcardInput = { front, back, hint: form.hint?.trim() || null, awsServiceId: form.awsServiceId || null, topic: form.topic?.trim() || null };
    try {
      if (mode === "edit" && selectedCard) {
        const { card } = await updateFlashcard(selectedCard.id, payload);
        setCards((previous) => previous.map((item) => item.id === card.id ? withOverdue(card) : item));
        setMode("read");
        toast.success("Flashcard atualizado");
      } else {
        const { card } = await createFlashcard(payload);
        setCards((previous) => [withOverdue(card), ...previous]);
        closeSheet();
        toast.success("Flashcard criado");
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar flashcard."); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!selectedCard) return;
    setDeleting(true);
    try {
      await deleteFlashcard(selectedCard.id);
      setCards((previous) => previous.filter((card) => card.id !== selectedCard.id));
      closeSheet();
      toast.success("Flashcard excluído");
      requestAnimationFrame(() => countRef.current?.focus());
    } catch (error) {
      setConfirmDelete(false);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir flashcard.");
    } finally { setDeleting(false); }
  }

  const filterChips: { key: string; label: string; clear: () => void }[] = [];
  if (criteria.query) filterChips.push({ key: "query", label: `Busca: ${criteria.query}`, clear: () => setCriteria((value) => ({ ...value, query: "" })) });
  if (criteria.origin !== "all") filterChips.push({ key: "origin", label: criteria.origin === "user" ? "Meus" : "Automáticos", clear: () => setCriteria((value) => ({ ...value, origin: "all" })) });
  if (criteria.queue !== "all") filterChips.push({ key: "queue", label: criteria.queue === "queued" ? "Na esteira" : "Fora da esteira", clear: () => setCriteria((value) => ({ ...value, queue: "all" })) });
  if (criteria.due !== "all") filterChips.push({ key: "due", label: criteria.due === "overdue" ? "Atrasados" : "Em dia", clear: () => setCriteria((value) => ({ ...value, due: "all" })) });
  if (criteria.awsServiceId) filterChips.push({ key: "service", label: serviceNames.get(criteria.awsServiceId) ?? "Serviço AWS", clear: () => setCriteria((value) => ({ ...value, awsServiceId: null })) });

  const toolbar = (
    <PixelCard className="flex flex-col gap-4 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pixel-subtext)]" />
        <Input aria-label="Buscar flashcards" placeholder="Buscar em pergunta, resposta, dica ou serviço" value={criteria.query} onChange={(event) => setCriteria((value) => ({ ...value, query: event.target.value }))} className="min-h-11 pl-10 font-reading" />
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <RadioGroup label="Origem" value={criteria.origin} options={[["all", "Todos"], ["user", "Meus"], ["auto", "Automáticos"]]} onChange={(origin) => setCriteria((value) => ({ ...value, origin: origin as FlashcardCriteria["origin"] }))} />
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Ordenar por<select value={criteria.sort} onChange={(event) => setCriteria((value) => ({ ...value, sort: event.target.value as FlashcardCriteria["sort"] }))} className="min-h-11 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 font-mono text-[10px] text-[var(--pixel-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)]"><option value="createdDesc">Mais recentes</option><option value="dueAsc">Vencimento mais próximo</option><option value="easeAsc">Mais difíceis primeiro</option></select></label>
      </div>
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger asChild><button type="button" aria-expanded={filtersOpen} className="flex min-h-11 items-center gap-2 font-mono text-[10px] uppercase text-[var(--pixel-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)]"><SlidersHorizontal className="h-4 w-4" />Filtros ({panelFilterCount})</button></CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 border-t-2 border-[var(--pixel-border)] pt-4">
          <RadioGroup label="Esteira" value={criteria.queue} options={[["all", "Todos"], ["queued", "Na esteira"], ["suspended", "Fora da esteira"]]} onChange={(queue) => setCriteria((value) => ({ ...value, queue: queue as FlashcardCriteria["queue"] }))} />
          <RadioGroup label="Vencimento" value={criteria.due} options={[["all", "Todos"], ["overdue", "Atrasados"], ["upcoming", "Em dia"]]} onChange={(due) => setCriteria((value) => ({ ...value, due: due as FlashcardCriteria["due"] }))} />
          <div><p className="mb-2 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Serviço AWS</p><ServiceSearchSelect services={services} value={criteria.awsServiceId ?? ""} onChange={(id) => setCriteria((value) => ({ ...value, awsServiceId: id || null }))} /></div>
        </CollapsibleContent>
      </Collapsible>
      {filterChips.length > 0 && <div className="flex flex-wrap items-center gap-2">{filterChips.map((chip) => <Tooltip key={chip.key}><TooltipTrigger asChild><button type="button" onClick={chip.clear} aria-label={`Remover filtro: ${chip.label}`} className="inline-flex min-h-11 items-center gap-2 border-2 border-[var(--pixel-border)] px-2 font-mono text-[10px] text-[var(--pixel-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)]">{chip.label}<X className="h-3 w-3" /></button></TooltipTrigger><TooltipContent>{`Remover filtro: ${chip.label}`}</TooltipContent></Tooltip>)}<button type="button" onClick={clearFilters} className="min-h-11 px-2 font-mono text-[10px] uppercase text-[var(--pixel-text)] underline focus-visible:outline-2">Limpar tudo</button></div>}
    </PixelCard>
  );

  return <div className="mx-auto flex max-w-3xl min-w-0 flex-col gap-4 px-4 py-6">
    <PixelCard className="flex items-center justify-between gap-3"><h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">Meus Flashcards</h1><div className="flex gap-2"><PixelButton variant="ghost" onClick={openCreate} disabled={isLoading || Boolean(loadError)}><Plus className="h-4 w-4" /> Novo flashcard</PixelButton><PixelButton variant="ghost" onClick={onClose}>Voltar</PixelButton></div></PixelCard>

    {loadError ? <PixelCard role="alert" className="flex flex-col items-start gap-3 border-[var(--pixel-danger)]"><AlertTriangle className="h-5 w-5 text-[var(--pixel-danger)]" /><p className="font-reading text-sm text-[var(--pixel-text)]">{loadError}</p><PixelButton variant="ghost" onClick={() => void load()}>Tentar novamente</PixelButton></PixelCard> : isLoading ? <div aria-busy="true" className="flex flex-col gap-2">{Array.from({ length: 5 }, (_, index) => <PixelCard key={index} className="flex flex-col gap-3"><span className="h-4 w-2/3 animate-pulse bg-[var(--pixel-muted)] motion-reduce:animate-none" /><span className="h-3 w-1/3 animate-pulse bg-[var(--pixel-muted)] motion-reduce:animate-none" /></PixelCard>)}</div> : cards.length === 0 ? <PixelCard className="flex flex-col items-center gap-3 text-center"><h2 className="font-mono text-[10px] uppercase">Nenhum flashcard ainda</h2><p className="font-reading text-sm text-[var(--pixel-subtext)]">Os cards aparecem quando você erra ou marca questões no KC e no Simulado. Você também pode criar o seu.</p><PixelButton onClick={openCreate}><Plus className="h-4 w-4" /> Criar flashcard</PixelButton></PixelCard> : <>
      {toolbar}
      {cards.length === MY_CARDS_LIMIT && <PixelCard role="note" className="flex gap-2 border-dashed border-[var(--pixel-subtext)] bg-[var(--pixel-muted)] p-3 shadow-none"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p className="font-reading text-sm text-[var(--pixel-text)]"><strong>Mostrando seus {MY_CARDS_LIMIT} cards mais recentes.</strong> Cards mais antigos não aparecem aqui, nem na busca e nos filtros.</p></PixelCard>}
      <p ref={countRef} tabIndex={-1} aria-live="polite" className="font-mono text-[10px] text-[var(--pixel-subtext)] focus-visible:outline-2">{countFlashcards(cards, filteredCards.length)}</p>
      {filteredCards.length === 0 ? <PixelCard className="flex flex-col items-center gap-3 text-center"><h2 className="font-mono text-[10px] uppercase">Nenhum card para estes filtros</h2><PixelButton variant="ghost" onClick={clearFilters}>Limpar filtros</PixelButton></PixelCard> : <ul aria-label="Flashcards" className="flex min-w-0 flex-col gap-3">{filteredCards.map((card) => {
        const sourceLabel = getFlashcardSourceLabel(card.source);
        return <li key={card.id} className="min-w-0"><PixelCard className={`flex min-w-0 gap-3 border-l-[6px] p-3 transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--pixel-shadow)] ${sourceLabel.group === "user" ? "border-l-[var(--pixel-origin-user)]" : "border-l-[var(--pixel-origin-auto)]"}`}>
          <button type="button" onClick={() => openCard(card)} aria-label="Ver detalhes do flashcard" className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)]"><span className="border-2 border-[var(--pixel-border)] px-2 py-1 font-mono text-[10px] text-[var(--pixel-text)]">{sourceLabel.shortLabel}</span><RichText text={card.front} trustLinks={true} className="w-full break-all font-reading text-base font-semibold text-[var(--pixel-text)] [overflow-wrap:anywhere]" /><RichText text={card.back} trustLinks={true} className="line-clamp-2 w-full font-reading text-sm text-[var(--pixel-subtext)] [overflow-wrap:anywhere]" /><span className="flex flex-wrap gap-2 font-mono text-[9px] text-[var(--pixel-subtext)]"><span>{card.suspended ? "FORA DA ESTEIRA" : "NA ESTEIRA"}</span>{card.isOverdue && <span className="flex items-center gap-1 text-[var(--pixel-text)]"><AlertCircle className="h-3 w-3 text-[var(--pixel-danger)]" />ATRASADO</span>}</span></button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" disabled={queueingId === card.id} onClick={() => void handleQueueToggle(card)} aria-label={card.suspended ? "Colocar na esteira" : "Tirar da esteira"} className="my-auto flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[var(--pixel-border)] text-[var(--pixel-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)] disabled:opacity-50">{queueingId === card.id ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : card.suspended ? <ListPlus className="h-4 w-4" /> : <ListMinus className="h-4 w-4" />}</button>
            </TooltipTrigger>
            <TooltipContent>{card.suspended ? "Colocar na esteira" : "Tirar da esteira"}</TooltipContent>
          </Tooltip>
        </PixelCard></li>;
      })}</ul>}
    </>}

    <Sheet open={detailOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
      <SheetContent side="right" showCloseButton className="w-full gap-0 border-l-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-0 text-[var(--pixel-text)] shadow-[-4px_4px_0_0_var(--pixel-shadow)] sm:max-w-md">
        <SheetHeader className="shrink-0 border-b-2 border-[var(--pixel-border)] pr-14"><SheetTitle className="font-mono text-[10px] uppercase">{mode === "create" ? "Novo flashcard" : mode === "edit" ? "Editar flashcard" : "Flashcard"}</SheetTitle><SheetDescription className="sr-only">Conteúdo completo do flashcard</SheetDescription>{selectedCard && <div className="flex flex-wrap gap-2"><span className="border-2 border-[var(--pixel-border)] px-2 py-1 font-mono text-[10px]">{getFlashcardSourceLabel(selectedCard.source).longLabel}</span>{selectedCard.isOverdue && <span className="flex items-center gap-1 border-2 border-[var(--pixel-danger)] px-2 py-1 font-mono text-[10px]"><AlertCircle className="h-3 w-3 text-[var(--pixel-danger)]" />Atrasado</span>}</div>}</SheetHeader>
        {mode === "read" && selectedCard && <>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <section className="min-w-0"><h3 className="mb-2 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Pergunta</h3><RichText text={selectedCard.front} trustLinks={true} className={`break-words font-reading text-[var(--pixel-text)] [overflow-wrap:anywhere] ${selectedCard.front.length <= 140 ? "text-xl font-semibold" : "text-base font-semibold"}`} /></section>
            {selectedCard.hint && <section className="min-w-0"><h3 className="mb-2 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Dica</h3><p className="whitespace-pre-line break-words font-reading text-[0.8rem] leading-relaxed text-[var(--pixel-subtext)] [overflow-wrap:anywhere]">{selectedCard.hint}</p></section>}
            <section className="min-w-0"><h3 className="mb-2 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Resposta</h3><RichText text={selectedCard.back} trustLinks={true} className="whitespace-pre-line break-words font-reading text-base leading-relaxed [overflow-wrap:anywhere]" /></section>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t-2 border-[var(--pixel-border)] pt-4 font-reading text-[0.8rem]"><dt className="text-[var(--pixel-subtext)]">Serviço</dt><dd>{serviceNames.get(selectedCard.awsServiceId ?? "") ?? "—"}</dd><dt className="text-[var(--pixel-subtext)]">Tópico</dt><dd>{selectedCard.topic || "—"}</dd><dt className="text-[var(--pixel-subtext)]">Próxima revisão</dt><dd>{new Date(selectedCard.dueAt).toLocaleDateString("pt-BR")}</dd><dt className="text-[var(--pixel-subtext)]">Intervalo</dt><dd>{selectedCard.intervalDays} {selectedCard.intervalDays === 1 ? "dia" : "dias"}</dd></dl>
          </div>
          <SheetFooter className="shrink-0 border-t-2 border-[var(--pixel-border)]">
            {!confirmDelete ? <><PixelButton type="button" variant="ghost" onClick={() => void handleQueueToggle(selectedCard)} disabled={queueingId === selectedCard.id} className="min-h-11 w-full">{selectedCard.suspended ? <ListPlus className="h-4 w-4" /> : <ListMinus className="h-4 w-4" />}{selectedCard.suspended ? "Colocar na esteira" : "Tirar da esteira"}</PixelButton>{selectedCard.source === "USER_CREATED" ? <div className="flex gap-2"><PixelButton type="button" variant="ghost" onClick={startEdit} className="min-h-11 flex-1"><Pencil className="h-4 w-4" />Editar</PixelButton><PixelButton type="button" variant="ghost" onClick={() => setConfirmDelete(true)} className="min-h-11 flex-1 border-[var(--pixel-danger)]"><Trash2 className="h-4 w-4 text-[var(--pixel-danger)]" />Excluir</PixelButton></div> : <p className="font-reading text-xs text-[var(--pixel-subtext)]">Cards automáticos não podem ser editados nem excluídos. Você pode tirá-los da esteira.</p>}</> : <><p role="alert" className="font-reading text-sm">Excluir este card de vez? Não dá para desfazer.</p><div className="flex gap-2"><PixelButton ref={cancelDeleteRef} type="button" variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(false)} className="min-h-11 flex-1">Cancelar</PixelButton><PixelButton type="button" variant="destructive" disabled={deleting} onClick={() => void handleDelete()} className="min-h-11 flex-1"><Trash2 className="h-4 w-4" />Excluir</PixelButton></div></>}
          </SheetFooter>
        </>}
        {(mode === "edit" || mode === "create") && <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Pergunta<Input value={form.front} onChange={(event) => setForm((value) => ({ ...value, front: event.target.value }))} maxLength={300} required aria-describedby="front-count" className="font-reading normal-case" /></label><FieldCounter id="front-count" value={form.front} limit={300} />
            <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Resposta<textarea value={form.back} onChange={(event) => setForm((value) => ({ ...value, back: event.target.value }))} maxLength={2000} rows={6} required aria-describedby="back-count" className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 font-reading text-base text-[var(--pixel-text)] outline-none placeholder:text-muted-foreground focus-visible:border-ring" /></label><FieldCounter id="back-count" value={form.back} limit={2000} />
            <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Dica<Input value={form.hint ?? ""} onChange={(event) => setForm((value) => ({ ...value, hint: event.target.value }))} maxLength={300} aria-describedby="hint-count" className="font-reading normal-case" /></label><FieldCounter id="hint-count" value={form.hint ?? ""} limit={300} />
            <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Tópico<Input value={form.topic ?? ""} onChange={(event) => setForm((value) => ({ ...value, topic: event.target.value }))} className="font-reading normal-case" /></label>
            <label className="flex flex-col gap-2 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Serviço AWS (opcional)<ServiceSearchSelect services={services} value={form.awsServiceId ?? ""} onChange={(id) => setForm((value) => ({ ...value, awsServiceId: id }))} /></label>
          </div>
          <SheetFooter className="shrink-0 border-t-2 border-[var(--pixel-border)]"><PixelButton type="submit" disabled={saving} className="min-h-11">{saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{mode === "create" ? "Criar" : "Salvar"}</PixelButton><PixelButton type="button" variant="ghost" disabled={saving} onClick={() => mode === "create" ? closeSheet() : setMode("read")} className="min-h-11">Cancelar</PixelButton></SheetFooter>
        </form>}
      </SheetContent>
    </Sheet>
  </div>;
}
