"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MentorActionList } from "@/features/mentor/components/MentorActionList";
import { fetchMentorRecommendations, type MentorRecommendation } from "@/features/mentor/services/mentor-api";

/**
 * Full mentor screen: header, ranked recommendation list, and last-updated timestamp.
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
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">
            Mentor IA
          </h1>
          <p className="mt-1 font-mono text-xs text-[var(--pixel-muted)]">
            Prioridades personalizadas para seu próximo estudo
          </p>
        </div>
        {updatedLabel && (
          <span className="flex-shrink-0 font-mono text-xs text-[var(--pixel-muted)]">
            {updatedLabel}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <p className="font-mono text-sm text-red-500">{error}</p>
      )}

      {/* Recommendation list */}
      <MentorActionList
        recommendations={isLoading ? null : (recommendations ?? [])}
        isLoading={isLoading}
      />
    </div>
  );
}
