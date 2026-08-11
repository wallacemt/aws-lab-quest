"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PixelCard } from "@/components/ui/pixel-card";

type Journey = {
  id: string;
  certificationLabel: string;
  status: "ACTIVE" | "ARCHIVED";
  startedAt: string;
  endedAt: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function PastJourneysCard({ userId }: { userId: string }) {
  const router = useRouter();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/journeys", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { journeys?: Journey[] }) => {
        setJourneys((data.journeys ?? []).filter((j) => j.status === "ARCHIVED"));
      })
      .catch(() => void 0)
      .finally(() => setLoading(false));
  }, []);

  if (loading || journeys.length === 0) return null;

  return (
    <PixelCard className="space-y-3">
      <h3 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Jornadas anteriores</h3>
      <div className="space-y-2">
        {journeys.map((journey) => (
          <button
            key={journey.id}
            type="button"
            onClick={() =>
              router.push(
                `/players/${userId}?journeyId=${journey.id}&journeyLabel=${encodeURIComponent(journey.certificationLabel)}`
              )
            }
            className="flex w-full items-center justify-between border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-left font-sans text-sm text-[var(--pixel-text)] transition-colors hover:border-[var(--pixel-primary)]"
          >
            <span>{journey.certificationLabel || "Certificacao"}</span>
            <span className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">
              {formatDate(journey.startedAt)}
              {journey.endedAt ? ` - ${formatDate(journey.endedAt)}` : ""}
            </span>
          </button>
        ))}
      </div>
    </PixelCard>
  );
}
