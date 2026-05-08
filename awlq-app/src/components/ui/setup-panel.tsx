"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";

export function SetupPanel({
  onGenerate,
  theme,
  labText,
  onThemeChange,
  onLabTextChange,
  loading,
  disabled,
}: {
  onGenerate: (theme: string, labText: string) => Promise<void>;
  theme: string;
  labText: string;
  onThemeChange: (value: string) => void;
  onLabTextChange: (value: string) => void;
  loading: boolean;
  disabled?: boolean;
}) {
  const labTextLimit = 25000;
  const isNearLimit = labText.length >= labTextLimit * 0.9;

  return (
    <PixelCard className="space-y-4">
      <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Configurar Quest</h2>
      <label className="block text-sm">
        Tema favorito
        <input
          className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)]"
          placeholder="musica, games, futebol, anime..."
          value={theme}
          onChange={(e) => onThemeChange(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <div className="flex items-center justify-between">
          <span>Texto do laboratorio AWS</span>
          <span
            className={`font-mono text-[9px] uppercase ${
              isNearLimit ? "text-yellow-300" : "text-[var(--pixel-subtext)]"
            }`}
          >
            {labText.length}/{labTextLimit}
          </span>
        </div>
        <textarea
          className="mt-1 min-h-52 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)]"
          placeholder="Cole o laboratorio completo"
          value={labText}
          onChange={(e) => onLabTextChange(e.target.value)}
          maxLength={labTextLimit}
          disabled={disabled}
        />
      </label>
      <PixelButton
        disabled={loading || disabled}
        className="w-full"
        onClick={async () => {
          await onGenerate(theme.trim(), labText.trim());
        }}
      >
        {loading ? "Gerando..." : "Gerar Quest"}
      </PixelButton>
    </PixelCard>
  );
}
