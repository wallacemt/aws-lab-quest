"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { MentorActionList } from "@/features/mentor/components/MentorActionList";
import { fetchMentorRecommendations, type MentorRecommendation } from "@/features/mentor/services/mentor-api";

/**
 * Full mentor screen with Mestre Yoda persona.
 * Loads ranked recommendations and presents them under the Yoda avatar card.
 */
export function MentorScreen() {
  const [recommendations, setRecommendations] = useState<MentorRecommendation[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMentorRecommendations();
      setRecommendations(data.recommendations);
      setGeneratedAt(data.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar recomendações.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updatedLabel = generatedAt
    ? `Atualizado ${formatDistanceToNow(new Date(generatedAt), { addSuffix: true, locale: ptBR })}`
    : null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Yoda avatar card */}
        <div className="retro-border bg-pixel-card p-6 retro-shadow mb-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-green-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 border-2 border-green-500 bg-green-900/30 flex items-center justify-center text-4xl shrink-0">
              🧙
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-green-400 tracking-widest mb-1">
                Mestre Yoda — IA Mentor
              </p>
              <h1 className="font-mono text-lg font-bold uppercase text-[var(--pixel-text)]">
                Guia do Jedi AWS
              </h1>
              <p className="font-mono text-xs text-[var(--pixel-muted)] mt-1 italic">
                &ldquo;Forte na Cloud, você deve ser. O caminho da certificação, longo é — mas começar,
                o mais importante.&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Last updated as Yoda line */}
        {updatedLabel && (
          <p className="font-mono text-xs text-[var(--pixel-muted)] mb-4 italic">
            &ldquo;{updatedLabel}, a última análise foi.&rdquo;
          </p>
        )}

        {/* Section header */}
        <p className="font-mono text-xs uppercase text-[var(--pixel-muted)] mb-3 tracking-widest">
          Suas prioridades de hoje
        </p>

        {/* Error state */}
        {error && !isLoading && (
          <div className="retro-border bg-pixel-card p-4 mb-4">
            <p className="font-mono text-xs text-red-500">
              &ldquo;Carregar suas recomendações, não consegui. Tentar novamente, você deve: {error}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 font-mono text-xs text-[var(--pixel-accent)] underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Recommendation list */}
        <MentorActionList
          recommendations={isLoading ? null : (recommendations ?? [])}
          isLoading={isLoading}
        />
      </div>
    </AppLayout>
  );
}
