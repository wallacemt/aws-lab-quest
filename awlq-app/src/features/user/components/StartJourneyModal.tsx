"use client";

import { useEffect, useState } from "react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import type { CertificationPreset } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  certificationOptions: CertificationPreset[];
  currentCertification: string;
  onStarted: () => void;
};

export function StartJourneyModal({ open, onClose, certificationOptions, currentCertification, onStarted }: Props) {
  const [certPresetId, setCertPresetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCertPresetId("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleConfirm() {
    if (!certPresetId) {
      setError("Selecione a certificação que você vai estudar agora.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/journeys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificationPresetId: certPresetId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível iniciar a nova jornada.");
      onStarted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a nova jornada.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <PixelCard className="w-full max-w-md space-y-4">
        <div>
          <p className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Nova jornada de certificação</p>
          <p className="mt-2 font-sans text-sm leading-6 text-[var(--pixel-text)]">
            Seu XP, nível e histórico atuais {currentCertification && <>(de <strong>{currentCertification}</strong>)</>}{" "}
            serão arquivados — não apagados, só deixam de aparecer no seu perfil. A evolução recomeça do zero para a
            nova certificação.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
            Qual certificação você vai estudar agora?
          </span>
          <select
            value={certPresetId}
            onChange={(e) => setCertPresetId(e.target.value)}
            className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-sans text-sm text-[var(--pixel-text)]"
          >
            <option value="">Selecionar certificação</option>
            {certificationOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>

        {error && (
          <PixelCard className="border-red-500 bg-red-900/20 py-2">
            <p className="font-sans text-sm text-red-300">{error}</p>
          </PixelCard>
        )}

        <div className="flex justify-end gap-2 border-t-2 border-[var(--pixel-border)] pt-3">
          <PixelButton variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </PixelButton>
          <PixelButton onClick={() => void handleConfirm()} disabled={submitting || !certPresetId}>
            {submitting ? "Iniciando..." : "Arquivar e iniciar nova jornada"}
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
}
