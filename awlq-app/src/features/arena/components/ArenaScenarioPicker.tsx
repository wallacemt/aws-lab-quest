"use client";

import { useState } from "react";
import { ARENA_SCENARIOS } from "@/lib/arena-scenarios";
import { PixelButton } from "@/components/ui/pixel-button";
import Link from "next/dist/client/link";
import { useRouter } from "next/navigation";

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
};

export function ArenaScenarioPicker({ selectedId, onSelect, onConfirm }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <PixelButton variant="ghost" onClick={() => router.back()}>
          ← Voltar
        </PixelButton>
        <span className="font-mono text-xs text-[#334155]">/</span>
        <p className="text-center font-mono text-xs uppercase text-[#f97316]">Escolha o cenário da batalha</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ARENA_SCENARIOS.map((scenario) => {
          const isSelected = scenario.id === selectedId;
          const isPreviewing = hoveredId === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelect(scenario.id)}
              onMouseEnter={() => setHoveredId(scenario.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`group relative aspect-video overflow-hidden border-2 ${
                isSelected ? "border-[#f97316]" : "border-[#1e293b] hover:border-[#334155]"
              }`}
            >
              {isPreviewing ? (
                <video
                  src={scenario.previewUrl}
                  poster={scenario.posterUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={scenario.posterUrl}
                  alt={scenario.label}
                  className="h-full w-full object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-left font-mono text-[9px] uppercase text-[#e2e8f0]">
                {scenario.label}
              </span>
              {isSelected && (
                <span className="absolute right-1 top-1 bg-[#f97316] px-1 font-mono text-[9px] font-bold text-black">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <PixelButton className="w-full" onClick={onConfirm}>
        Iniciar batalha
      </PixelButton>
    </div>
  );
}
