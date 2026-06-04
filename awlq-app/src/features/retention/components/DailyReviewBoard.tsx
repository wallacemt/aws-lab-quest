"use client";

import { useEffect } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { MemoryRecoveryCard } from "@/features/retention/components/MemoryRecoveryCard";
import { useDailyReview } from "@/features/retention/hooks/useDailyReview";

type Props = {
  onStartFlashcards?: () => void;
};

/**
 * Renders the daily review board: due flashcards, recent wrong questions,
 * weak AWS services, and memory recovery items.
 */
export function DailyReviewBoard({ onStartFlashcards }: Props) {
  const { data, recoveryItems, isLoading, error, load } = useDailyReview();

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <p className="font-mono text-sm text-[var(--pixel-muted)]">Carregando revisão...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="font-mono text-sm text-red-500">{error}</p>
        <PixelButton variant="ghost" onClick={() => void load()}>
          Tentar novamente
        </PixelButton>
      </div>
    );
  }

  if (!data) return null;

  const hasContent =
    data.dueFlashcards.length > 0 ||
    data.recentWrong.length > 0 ||
    data.weakServices.length > 0 ||
    recoveryItems.length > 0;

  if (!hasContent) {
    return (
      <PixelCard className="text-center">
        <p className="font-mono text-sm text-[var(--pixel-muted)]">
          Tudo em dia! Nenhuma revisão pendente por agora.
        </p>
      </PixelCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Flashcards due */}
      {data.dueFlashcards.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
            Flashcards para Revisar ({data.dueFlashcards.length})
          </h2>
          <PixelCard className="flex items-center justify-between gap-4">
            <p className="font-mono text-sm text-[var(--pixel-text)]">
              {data.dueFlashcards.length} card{data.dueFlashcards.length !== 1 ? "s" : ""} aguardando revisão.
            </p>
            {onStartFlashcards && (
              <PixelButton onClick={onStartFlashcards} className="shrink-0">
                Revisar
              </PixelButton>
            )}
          </PixelCard>
        </section>
      )}

      {/* Recent wrong answers */}
      {data.recentWrong.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
            Erradas Recentemente ({data.recentWrong.length})
          </h2>
          <div className="flex flex-col gap-2">
            {data.recentWrong.map((question) => (
              <PixelCard key={question.id}>
                <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-muted)] mb-1">
                  {question.awsService?.name ?? question.topic}
                </p>
                <p className="font-mono text-sm leading-relaxed text-[var(--pixel-text)] line-clamp-2">
                  {question.statement}
                </p>
              </PixelCard>
            ))}
          </div>
        </section>
      )}

      {/* Weak AWS services */}
      {data.weakServices.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
            Serviços Fracos
          </h2>
          <div className="flex flex-col gap-2">
            {data.weakServices.map((service) => (
              <PixelCard key={service.code} className="flex items-center justify-between">
                <span className="font-mono text-sm text-[var(--pixel-text)]">{service.name}</span>
                <span className="font-mono text-xs text-red-500">
                  {Math.round(service.correctRate * 100)}% correto
                </span>
              </PixelCard>
            ))}
          </div>
        </section>
      )}

      {/* Memory recovery */}
      {recoveryItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-accent)]">
            Revisitar Memórias Antigas
          </h2>
          <div className="flex flex-col gap-2">
            {recoveryItems.map((item) => (
              <MemoryRecoveryCard key={item.question.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
