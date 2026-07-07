"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { Input } from "@/components/ui/input";
import {
  Flashcard,
  FlashcardInput,
  createFlashcard,
  deleteFlashcard,
  fetchMyFlashcards,
  updateFlashcard,
} from "@/features/retention/services/retention-api";
import { listStudyServices, StudyServiceItem } from "@/features/study/services/study-api";
import { ServiceSearchSelect } from "@/features/retention/components/ServiceSearchSelect";

type Props = {
  onClose: () => void;
};

const EMPTY_FORM: FlashcardInput = { front: "", back: "", hint: "", awsServiceId: "", topic: "" };

/**
 * CRUD screen for the user's own flashcards (source = USER_CREATED).
 * Issue #22 AC: criar/editar/excluir flashcards proprios.
 */
export function FlashcardManager({ onClose }: Props) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [services, setServices] = useState<StudyServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FlashcardInput>(EMPTY_FORM);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [{ cards: myCards }, serviceList] = await Promise.all([fetchMyFlashcards(), listStudyServices()]);
      setCards(myCards);
      setServices(serviceList);
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
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
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
        setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
      } else {
        const { card } = await createFlashcard(payload);
        setCards((prev) => [card, ...prev]);
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

      <PixelCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-subtext)]">
            {editingId ? "Editar flashcard" : "Novo flashcard"}
          </p>

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
      </PixelCard>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <p className="font-mono text-xs text-[var(--pixel-subtext)]">Carregando...</p>
        ) : cards.length === 0 ? (
          <p className="font-mono text-xs text-[var(--pixel-subtext)]">Voce ainda nao criou nenhum flashcard.</p>
        ) : (
          cards.map((card) => (
            <PixelCard key={card.id} className="flex flex-col gap-2">
              <p className="font-mono text-sm text-[var(--pixel-text)]">{card.front}</p>
              <p className="font-mono text-xs text-[var(--pixel-text)]">{card.back}</p>
              <div className="flex gap-2">
                <PixelButton variant="ghost" onClick={() => startEdit(card)}>
                  Editar
                </PixelButton>
                <PixelButton variant="ghost" onClick={() => void handleDelete(card.id)}>
                  Excluir
                </PixelButton>
              </div>
            </PixelCard>
          ))
        )}
      </div>
    </div>
  );
}
