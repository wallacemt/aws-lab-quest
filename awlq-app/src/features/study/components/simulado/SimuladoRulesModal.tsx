"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";

type Props = {
  open: boolean;
  packName: string | null;
  rulesAccepted: boolean;
  loading: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SimuladoRulesModal({ open, packName, rulesAccepted, loading, onAcceptedChange, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <PixelCard className="w-full max-w-2xl space-y-4 border-yellow-500 bg-yellow-900/95">
        <p className="font-mono text-[10px] uppercase text-yellow-300">Regras do Simulado</p>
        <h3 className="font-[var(--font-body)] text-xl">
          {packName ?? "Ambiente de prova real"}
        </h3>

        <ul className="space-y-2 font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
          <li>1. O simulado possui 65 questoes e cronometro ativo.</li>
          <li>2. Nao e permitido consultar materiais externos durante a prova.</li>
          <li>3. O objetivo e simular o ambiente real da certificacao AWS.</li>
          <li>4. Ao iniciar, mantenha foco continuo ate o envio final.</li>
        </ul>

        <label className="flex items-start gap-3 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-3">
          <input
            type="checkbox"
            checked={rulesAccepted}
            onChange={(e) => onAcceptedChange(e.target.checked)}
            className="mt-1"
          />
          <span className="font-[var(--font-body)] text-sm">
            Li e aceito as regras do simulado para reproduzir um ambiente real de prova.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <PixelButton variant="ghost" onClick={onCancel}>
            Cancelar
          </PixelButton>
          <PixelButton onClick={onConfirm} disabled={!rulesAccepted || loading}>
            Aceitar e iniciar simulado
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
}
