"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { data, recoveryItems, streakDays, isLoading, isCompleting, error, load, complete } = useDailyReview();
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <p className="font-mono text-sm text-[var(--pixel-accent)]">Carregando revisão...</p>
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
        <p className="font-mono text-sm text-[var(--pixel-accent)]">
          Tudo em dia! Nenhuma revisão pendente por agora.
        </p>
      </PixelCard>
    );
  }

  async function handleComplete() {
    await complete();
    setCompleted(true);
  }

  if (completed) {
    return (
      <PixelCard className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="font-mono text-2xl text-[var(--pixel-accent)]">Revisão concluída!</p>
        {streakDays !== null && (
          <p className="font-mono text-sm text-[var(--pixel-text)]">
            Sequência atual: <span className="text-yellow-400 font-bold">{streakDays} dia{streakDays !== 1 ? "s" : ""}</span>
          </p>
        )}
        <PixelButton variant="ghost" onClick={() => { setCompleted(false); void load(); }}>
          Ver revisão novamente
        </PixelButton>
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
              <PixelCard key={question.id} className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-subtext )] mb-1">
                    {question.awsService?.name ?? question.topic}
                  </p>
                  <p className="font-mono text-sm leading-relaxed text-[var(--pixel-text)] line-clamp-2">
                    {question.statement}
                  </p>
                </div>
                <PixelButton
                  variant="ghost"
                  className="shrink-0 text-xs"
                  onClick={() => router.push("/revisao")}
                >
                  Rever
                </PixelButton>
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
              <PixelCard key={service.code} className="flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-sm text-[var(--pixel-text)]">{service.name}</span>
                  <span className="block font-mono text-xs text-red-500">
                    {Math.round(service.correctRate * 100)}% correto
                  </span>
                </div>
                <PixelButton
                  variant="ghost"
                  className="shrink-0 text-xs"
                  onClick={() => router.push("/kc")}
                >
                  Praticar
                </PixelButton>
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

      {/* Complete review */}
      <div className="flex justify-center pt-2">
        <PixelButton onClick={() => void handleComplete()} disabled={isCompleting}>
          {isCompleting ? "Salvando..." : "Concluir Revisão"}
        </PixelButton>
      </div>
    </div>
  );
}
