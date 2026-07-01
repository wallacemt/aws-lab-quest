"use client";

import { useRouter } from "next/navigation";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import type { MentorRecommendation } from "@/features/mentor/services/mentor-api";

// ─── Action type metadata ─────────────────────────────────────────────────────

type ActionMeta = {
  label: string;
  colorClass: string;
  badgeClass: string;
  buildHref: (targetRef: string | null) => string;
};

const ACTION_META: Record<string, ActionMeta> = {
  review_service: {
    label: "Revisar",
    colorClass: "text-red-500",
    badgeClass: "bg-red-500/10 text-red-500 border border-red-500/30",
    buildHref: (ref) => (ref ? `/kc?service=${encodeURIComponent(ref)}` : "/kc"),
  },
  flashcards: {
    label: "Flashcards",
    colorClass: "text-blue-400",
    badgeClass: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    buildHref: () => "/flashcards",
  },
  sprint: {
    label: "Sprint",
    colorClass: "text-green-400",
    badgeClass: "bg-green-500/10 text-green-400 border border-green-500/30",
    buildHref: (ref) => (ref ? `/sprint?service=${encodeURIComponent(ref)}` : "/sprint"),
  },
  kc: {
    label: "KC",
    colorClass: "text-yellow-400",
    badgeClass: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
    buildHref: (ref) => (ref ? `/kc?service=${encodeURIComponent(ref)}` : "/kc"),
  },
  library: {
    label: "Biblioteca",
    colorClass: "text-purple-400",
    badgeClass: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
    buildHref: () => "/biblioteca",
  },
};

const DEFAULT_META: ActionMeta = {
  label: "Ver",
  colorClass: "text-[var(--pixel-muted)]",
  badgeClass: "bg-[var(--pixel-surface)] text-[var(--pixel-muted)] border border-[var(--pixel-border)]",
  buildHref: () => "/",
};

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function MentorActionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-md bg-[var(--pixel-surface)]"
        />
      ))}
    </div>
  );
}

// ─── Single recommendation row ────────────────────────────────────────────────

type RecommendationRowProps = {
  recommendation: MentorRecommendation;
};

function RecommendationRow({ recommendation }: RecommendationRowProps) {
  const router = useRouter();
  const meta = ACTION_META[recommendation.actionType] ?? DEFAULT_META;
  const href = meta.buildHref(recommendation.targetRef);

  return (
    <PixelCard className="flex items-start gap-4 p-4">
      {/* Rank badge */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--pixel-accent)] font-mono text-sm font-bold text-[var(--pixel-bg)]">
        {recommendation.rank}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-[var(--pixel-text)]">
            {recommendation.title}
          </span>
          <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${meta.badgeClass}`}>
            {meta.label}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-[var(--pixel-muted)]">
          {recommendation.rationale}
        </p>
      </div>

      {/* Action button */}
      <PixelButton
        variant="ghost"
        className={`flex-shrink-0 text-xs ${meta.colorClass}`}
        onClick={() => router.push(href)}
      >
        Ir
      </PixelButton>
    </PixelCard>
  );
}

// ─── Main list component ──────────────────────────────────────────────────────

type Props = {
  recommendations: MentorRecommendation[] | null;
  isLoading?: boolean;
};

/**
 * Renders the ranked mentor recommendation list.
 *
 * - null recommendations + isLoading=true → skeleton
 * - empty array → empty state
 * - populated array → ranked list
 */
export function MentorActionList({ recommendations, isLoading = false }: Props) {
  if (isLoading || recommendations === null) {
    return <MentorActionSkeleton />;
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-mono text-sm text-pixel-subtext">
          Conclua uma sessão de estudo para receber recomendações personalizadas.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {recommendations.map((rec) => (
        <li key={rec.id}>
          <RecommendationRow recommendation={rec} />
        </li>
      ))}
    </ol>
  );
}
