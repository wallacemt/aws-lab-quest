"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Plus, Minus, Pencil, Trash2 } from "lucide-react";
import {
  Flashcard,
  FlashcardInput,
  createFlashcard,
  deleteFlashcard,
  fetchAllFlashcards,
  queueFlashcard,
  updateFlashcard,
} from "@/features/retention/services/retention-api";
import { listStudyServices, StudyServiceItem } from "@/features/study/services/study-api";
import { ServiceSearchSelect } from "@/features/retention/components/ServiceSearchSelect";

type Props = {
  onClose: () => void;
};

const EMPTY_FORM: FlashcardInput = { front: "", back: "", hint: "", awsServiceId: "", topic: "" };
const PAGE_SIZE = 9;

type FlashcardWithPriority = Flashcard & { isOverdue: boolean };

/**
 * Date.now() is impure and can't be called during render (react-hooks/purity).
 * "Overdue" is computed once here, at fetch/update time, and cached on the
 * card — not recalculated live on every render.
 */
function withOverdue(card: Flashcard): FlashcardWithPriority {
  return { ...card, isOverdue: new Date(card.dueAt).getTime() <= Date.now() };
}

/**
 * Manage-flashcards panel: browses every card the user owns (user-created +
 * system-generated from errors/reviews) so they can curate which ones sit in
 * the active review pipeline ("esteira") — add or remove via dueAt/suspended
 * (queueFlashcard) — plus the original create/edit/delete CRUD, which stays
 * scoped to USER_CREATED cards only (issue #22 AC).
 */
export function FlashcardManager({ onClose }: Props) {
  const [cards, setCards] = useState<FlashcardWithPriority[]>([]);
  const [services, setServices] = useState<StudyServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FlashcardInput>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [{ cards: allCards }, serviceList] = await Promise.all([fetchAllFlashcards(), listStudyServices()]);
      setCards(allCards.map(withOverdue));
      setServices(serviceList);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar flashcards.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(card: Flashcard) {
    setEditingId(card.id);
    setForm({
      front: card.front,
      back: card.back,
      hint: card.hint ?? "",
      awsServiceId: card.awsServiceId ?? "",
      topic: card.topic ?? "",
    });
    setFormOpen(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const front = form.front.trim();
    const back = form.back.trim();
    if (!front || !back) {
      setError("Frente e verso sao obrigatorios.");
      return;
    }

    setIsSaving(true);
    setError(null);
    const payload: FlashcardInput = {
      front,
      back,
      hint: form.hint?.trim() || null,
      awsServiceId: form.awsServiceId || null,
      topic: form.topic?.trim() || null,
    };

    try {
      if (editingId) {
        const { card } = await updateFlashcard(editingId, payload);
        setCards((prev) => prev.map((c) => (c.id === card.id ? withOverdue(card) : c)));
      } else {
        const { card } = await createFlashcard(payload);
        setCards((prev) => [withOverdue(card), ...prev]);
      }
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar flashcard.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(flashcardId: string) {
    setError(null);
    try {
      await deleteFlashcard(flashcardId);
      setCards((prev) => prev.filter((c) => c.id !== flashcardId));
      if (editingId === flashcardId) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir flashcard.");
    }
  }

  async function handleQueueToggle(card: Flashcard) {
    setError(null);
    setQueueingId(card.id);
    try {
      const action = card.suspended ? "add" : "remove";
      const { card: updated } = await queueFlashcard(card.id, action);
      setCards((prev) => prev.map((c) => (c.id === updated.id ? withOverdue(updated) : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar a fila de revisão.");
    } finally {
      setQueueingId(null);
    }
  }

  const query = search.trim().toLowerCase();
  const filteredCards = query
    ? cards.filter(
        (c) =>
          c.front.toLowerCase().includes(query) ||
          c.back.toLowerCase().includes(query) ||
          (c.topic ?? "").toLowerCase().includes(query),
      )
    : cards;
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageCards = filteredCards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <PixelCard className="flex items-center justify-between gap-3">
        <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">Meus Flashcards</h1>
        <PixelButton variant="ghost" onClick={onClose}>
          Voltar
        </PixelButton>
      </PixelCard>

      {error && (
        <PixelCard>
          <p className="font-mono text-xs text-red-500">{error}</p>
        </PixelCard>
      )}

      <PixelCard className="p-0">
        <Collapsible open={formOpen} onOpenChange={setFormOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 font-mono text-xs uppercase tracking-wide text-[var(--pixel-subtext)]"
            >
              {editingId ? "Editar flashcard" : "+ Novo flashcard"}
              {formOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-3 px-4 pb-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                placeholder="Frente (pergunta)"
                value={form.front}
                onChange={(e) => setForm((f) => ({ ...f, front: e.target.value }))}
                maxLength={300}
                required
              />

              <textarea
                placeholder="Verso (resposta)"
                value={form.back}
                onChange={(e) => setForm((f) => ({ ...f, back: e.target.value }))}
                maxLength={2000}
                rows={4}
                required
                className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 font-mono text-sm text-[var(--pixel-text)] outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />

              <Input
                placeholder="Dica (opcional)"
                value={form.hint ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
                maxLength={300}
              />

              <div className="flex flex-col gap-1">
                <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-subtext)]">
                  Serviço AWS (opcional)
                </p>
                <ServiceSearchSelect
                  services={services}
                  value={form.awsServiceId ?? ""}
                  onChange={(id) => setForm((f) => ({ ...f, awsServiceId: id }))}
                />
              </div>

              <div className="flex gap-2">
                <PixelButton type="submit" disabled={isSaving}>
                  {editingId ? "Salvar" : "Criar"}
                </PixelButton>
                {editingId && (
                  <PixelButton type="button" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                    Cancelar
                  </PixelButton>
                )}
              </div>
            </form>
          </CollapsibleContent>
        </Collapsible>
      </PixelCard>

      <PixelCard className="flex flex-col gap-3 p-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--pixel-subtext)]">
          Esteira de revisão — selecione quais flashcards entram na fila
        </p>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pixel-subtext)]" />
          <Input
            placeholder="Buscar por pergunta, resposta ou tópico..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8 text-xs"
          />
        </div>

        <TooltipProvider>
          <ScrollArea className="h-auto max-h-[420px] w-full">
            {isLoading ? (
              <p className="font-mono text-xs text-[var(--pixel-subtext)]">Carregando...</p>
            ) : filteredCards.length === 0 ? (
              <p className="font-mono text-xs text-[var(--pixel-subtext)]">
                {cards.length === 0 ? "Nenhum flashcard disponível ainda." : "Nenhum flashcard encontrado para a busca."}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 pr-3 sm:grid-cols-3">
                {pageCards.map((card) => {
                  const isUserCreated = card.source === "USER_CREATED";
                  const { isOverdue } = card;

                  return (
                    <PixelCard
                      key={card.id}
                      className={`flex flex-col gap-1.5 p-2 text-xs ${
                        isUserCreated ? "border-blue-400/60 bg-blue-500/10" : "border-red-400/60 bg-red-500/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="line-clamp-2 font-mono text-[11px] text-[var(--pixel-text)]">{card.front}</p>
                        {isUserCreated ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="shrink-0 rounded border border-blue-400/60 px-1 py-0.5 font-mono text-[8px] uppercase text-blue-500">
                                Custom
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Criado por você</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`shrink-0 rounded border border-red-400/60 px-1 py-0.5 font-mono text-[8px] uppercase text-red-500 ${
                                  isOverdue ? "font-bold" : ""
                                }`}
                              >
                                {isOverdue ? "Alta" : "Erro"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isOverdue ? "Prioridade alta — vencido" : "Gerado a partir de erros/revisões"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="line-clamp-2 font-mono text-[10px] text-[var(--pixel-subtext)]">{card.back}</p>
                      <div className="mt-auto flex flex-wrap gap-1 pt-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              disabled={queueingId === card.id}
                              onClick={() => void handleQueueToggle(card)}
                              className="rounded border border-pixel-border p-1 text-[var(--pixel-text)] disabled:opacity-50"
                            >
                              {card.suspended ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{card.suspended ? "Adicionar à revisão" : "Remover da fila"}</TooltipContent>
                        </Tooltip>
                        {isUserCreated && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => startEdit(card)}
                                  className="rounded border border-pixel-border p-1 text-[var(--pixel-text)]"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(card.id)}
                                  className="rounded border border-pixel-border p-1 text-red-500"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </PixelCard>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TooltipProvider>

        {filteredCards.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-4 pt-1">
            <PixelButton
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </PixelButton>
            <span className="font-mono text-[10px] text-[var(--pixel-subtext)]">
              Página {currentPage} / {totalPages}
            </span>
            <PixelButton
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </PixelButton>
          </div>
        )}
      </PixelCard>
    </div>
  );
}
