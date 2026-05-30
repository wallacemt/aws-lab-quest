"use client";

import { useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { THEME_PRESETS } from "@/lib/themes";
import { BG_PRESETS, type BgPreset } from "@/lib/backgrounds";
import { useUserProfileStore } from "@/stores/userProfileStore";

export function PersonalizationTab() {
  const { profile, reloadProfile, patchPersonalization } = useUserProfileStore();

  const [selectedTheme, setSelectedTheme] = useState(profile.themePreset ?? "default");
  const [selectedBg, setSelectedBg] = useState(profile.bgImageUrl ?? "");
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);

    const bgImageUrl = customBgUrl.trim() || selectedBg || null;

    try {
      const res = await fetch("/api/user/personalization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ themePreset: selectedTheme, bgImageUrl }),
      });
      const data = (await res.json()) as { bgImageUrl?: string | null; themePreset?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");

      // Apply immediately to the store so ThemeApplier reacts without a network round-trip.
      patchPersonalization({
        themePreset: data.themePreset ?? selectedTheme,
        bgImageUrl: data.bgImageUrl ?? bgImageUrl,
      });

      // Refresh in background to sync any other profile fields.
      void reloadProfile();

      setSaveMsg("Personalizacao salva!");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const presetsByCategory = {
    landing: BG_PRESETS.filter((b) => b.category === "landing"),
    "pixel-art": BG_PRESETS.filter((b) => b.category === "pixel-art"),
  };

  return (
    <div className="space-y-6">
      {/* Theme picker */}
      <PixelCard>
        <p className="mb-3 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Tema de cores</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedTheme(preset.id)}
              className={`flex flex-col items-center gap-1.5 border-2 p-3 transition-all ${
                selectedTheme === preset.id
                  ? "border-[var(--pixel-primary)] bg-[var(--pixel-card)]"
                  : "border-[var(--pixel-border)] bg-[var(--pixel-bg)] opacity-60 hover:opacity-100"
              }`}
            >
              <span className="text-2xl">{preset.emoji}</span>
              <span className="font-mono text-[9px] uppercase text-[var(--pixel-text)]">{preset.label}</span>
              {Object.keys(preset.vars).length > 0 && (
                <div
                  className="h-2 w-full"
                  style={{ background: preset.vars["--pixel-primary"] ?? "transparent" }}
                />
              )}
            </button>
          ))}
        </div>
      </PixelCard>

      {/* Background picker */}
      <PixelCard>
        <p className="mb-4 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Imagem de fundo</p>

        {/* None option */}
        <button
          type="button"
          onClick={() => { setSelectedBg(""); setCustomBgUrl(""); }}
          className={`mb-4 flex h-12 w-full items-center justify-center border-2 font-mono text-[10px] uppercase transition-all ${
            selectedBg === "" && !customBgUrl
              ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
              : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50"
          }`}
        >
          Sem imagem de fundo
        </button>

        {/* Landscapes */}
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--pixel-subtext)] opacity-60">
          Landscapes HD
        </p>
        <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-3">
          {presetsByCategory.landing.map((bg) => (
            <BgButton key={bg.id} bg={bg} selected={selectedBg === bg.url} onSelect={() => { setSelectedBg(bg.url); setCustomBgUrl(""); }} />
          ))}
        </div>

        {/* Pixel Art */}
        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--pixel-subtext)] opacity-60">
          Pixel Art City Night
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {presetsByCategory["pixel-art"].map((bg) => (
            <BgButton key={bg.id} bg={bg} selected={selectedBg === bg.url} onSelect={() => { setSelectedBg(bg.url); setCustomBgUrl(""); }} />
          ))}
        </div>

        {/* Custom URL */}
        <div className="mt-5 space-y-1 border-t border-[var(--pixel-border)] pt-4">
          <label className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
            URL personalizada (https://)
          </label>
          <input
            type="url"
            value={customBgUrl}
            onChange={(e) => {
              setCustomBgUrl(e.target.value);
              if (e.target.value) setSelectedBg("");
            }}
            placeholder="https://..."
            className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] outline-none focus:border-[var(--pixel-primary)]"
          />
        </div>
      </PixelCard>

      {/* Save */}
      <div className="flex items-center gap-3">
        <PixelButton onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Personalizacao"}
        </PixelButton>
        {saveMsg && <p className="font-mono text-xs text-green-400">{saveMsg}</p>}
        {saveError && <p className="font-mono text-xs text-red-400">{saveError}</p>}
      </div>
    </div>
  );
}

function BgButton({ bg, selected, onSelect }: { bg: BgPreset; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative h-20 overflow-hidden border-2 transition-all ${
        selected
          ? "border-[var(--pixel-primary)]"
          : "border-[var(--pixel-border)] opacity-70 hover:opacity-100"
      }`}
      title={bg.label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bg.url}
        alt={bg.label}
        className="h-full w-full object-cover"
        style={{ imageRendering: "pixelated" }}
      />
      {selected && (
        <div className="absolute inset-0 border-2 border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10" />
      )}
      <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 font-mono text-[8px] uppercase text-white text-center">
        {bg.label}
      </span>
    </button>
  );
}
