"use client";

import { useEffect, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { THEME_PRESETS, ALL_PIXEL_VARS, DEFAULT_PIXEL_VARS, PIXEL_VAR_LABELS, findThemePreset } from "@/lib/themes";
import { BG_PRESETS, type BgPreset } from "@/lib/backgrounds";
import { extractPaletteFromImageFile } from "@/lib/color-extraction";
import { useUserProfileStore } from "@/stores/userProfileStore";
import {
  fetchMyThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  fetchCommunityThemes,
  uploadThemeImage,
  updatePersonalization,
  type UserTheme,
  type CommunityTheme,
} from "@/features/user/services/theme-api";

type Tab = "cores" | "meus" | "comunidade";

export function PersonalizationTab() {
  const { profile, reloadProfile, patchPersonalization } = useUserProfileStore();
  const [tab, setTab] = useState<Tab>("cores");

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
      const data = await updatePersonalization({ themePreset: selectedTheme, bgImageUrl });

      // Apply immediately to the store so ThemeApplier reacts without a network round-trip.
      patchPersonalization({
        themePreset: data.themePreset ?? selectedTheme,
        bgImageUrl: data.bgImageUrl ?? bgImageUrl,
        customColors: data.customColors ?? null,
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

  async function applyCustomTheme(themeId: string, fallbackColors: Record<string, string>, fallbackBgImageUrl: string | null) {
    setSaveError(null);
    try {
      const data = await updatePersonalization({ customThemeId: themeId });
      patchPersonalization({
        customColors: data.customColors ?? fallbackColors,
        bgImageUrl: data.bgImageUrl ?? fallbackBgImageUrl ?? profile.bgImageUrl ?? null,
        themePreset: data.themePreset ?? profile.themePreset,
      });
      void reloadProfile();
      setSaveMsg("Tema aplicado!");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao aplicar tema.");
    }
  }

  const presetsByCategory = {
    landing: BG_PRESETS.filter((b) => b.category === "landing"),
    "pixel-art": BG_PRESETS.filter((b) => b.category === "pixel-art"),
  };

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b-2 border-[var(--pixel-border)]">
        {(["cores", "meus", "comunidade"] as const).map((t) => {
          const labels: Record<Tab, string> = { cores: "Cores & Fundo", meus: "Meus Temas", comunidade: "Comunidade" };
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 px-4 py-2 font-mono text-[10px] uppercase transition-colors ${
                tab === t
                  ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                  : "border-transparent text-[var(--pixel-subtext)] hover:text-[var(--pixel-text)]"
              }`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {saveMsg && <p className="font-mono text-xs text-green-400">{saveMsg}</p>}
      {saveError && <p className="font-mono text-xs text-red-400">{saveError}</p>}

      {tab === "cores" && (
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

            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--pixel-subtext)] opacity-60">
              Landscapes HD
            </p>
            <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-3">
              {presetsByCategory.landing.map((bg) => (
                <BgButton key={bg.id} bg={bg} selected={selectedBg === bg.url} onSelect={() => { setSelectedBg(bg.url); setCustomBgUrl(""); }} />
              ))}
            </div>

            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--pixel-subtext)] opacity-60">
              Pixel Art City Night
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {presetsByCategory["pixel-art"].map((bg) => (
                <BgButton key={bg.id} bg={bg} selected={selectedBg === bg.url} onSelect={() => { setSelectedBg(bg.url); setCustomBgUrl(""); }} />
              ))}
            </div>

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

          <div className="flex items-center gap-3">
            <PixelButton onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Personalizacao"}
            </PixelButton>
          </div>
        </div>
      )}

      {tab === "meus" && <MyThemesTab profile={profile} onApply={applyCustomTheme} />}

      {tab === "comunidade" && <CommunityThemesTab onApply={applyCustomTheme} />}
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

function ColorSwatch({ colors }: { colors: Record<string, string> }) {
  const keys = ["--pixel-bg", "--pixel-primary", "--pixel-accent", "--pixel-card", "--pixel-border"];
  return (
    <div className="flex h-6 w-full overflow-hidden border border-[var(--pixel-border)]">
      {keys.map((k) => (
        <div key={k} className="flex-1" style={{ background: colors[k] ?? "transparent" }} />
      ))}
    </div>
  );
}

type ApplyFn = (themeId: string, colors: Record<string, string>, bgImageUrl: string | null) => Promise<void>;

function MyThemesTab({
  profile,
  onApply,
}: {
  profile: { themePreset?: string | null; customColors?: Record<string, string> | null };
  onApply: ApplyFn;
}) {
  const [themes, setThemes] = useState<UserTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const seedPreset = findThemePreset(profile.themePreset ?? "default");
  const seedColors: Record<string, string> =
    profile.customColors ??
    Object.fromEntries(ALL_PIXEL_VARS.map((v) => [v, seedPreset.vars[v] ?? DEFAULT_PIXEL_VARS[v]]));

  const [name, setName] = useState("");
  const [colors, setColors] = useState<Record<string, string>>(seedColors);
  const [bgUrl, setBgUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);

  async function loadThemes() {
    setLoading(true);
    setListError(null);
    try {
      const { themes: list } = await fetchMyThemes();
      setThemes(list);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Erro ao carregar temas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadThemes();
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setFormError(null);
    setExtractMsg(null);
    try {
      const { imageUrl } = await uploadThemeImage(file);
      setBgUrl(imageUrl);

      const palette = await extractPaletteFromImageFile(file);
      if (palette) {
        setColors(palette);
        setExtractMsg("Cores extraidas da imagem! Ajuste se quiser antes de salvar.");
        setTimeout(() => setExtractMsg(null), 4000);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      setFormError("Digite um nome para o tema.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await createTheme({ name, colors, bgImageUrl: bgUrl || null });
      setName("");
      setBgUrl("");
      await loadThemes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar tema.");
    } finally {
      setCreating(false);
    }
  }

  async function handleTogglePublic(theme: UserTheme) {
    const updated = await updateTheme(theme.id, { isPublic: !theme.isPublic });
    setThemes((prev) => prev.map((t) => (t.id === theme.id ? updated.theme : t)));
  }

  async function handleDelete(theme: UserTheme) {
    if (!confirm(`Excluir o tema "${theme.name}"?`)) return;
    await deleteTheme(theme.id);
    setThemes((prev) => prev.filter((t) => t.id !== theme.id));
  }

  return (
    <div className="space-y-6">
      <PixelCard>
        <p className="mb-3 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Criar novo tema</p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do tema"
          maxLength={40}
          className="mb-4 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] outline-none focus:border-[var(--pixel-primary)]"
        />

        <label className="mb-2 block font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
          Comecar a partir de um tema pronto (opcional)
        </label>
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-7">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setColors(Object.fromEntries(ALL_PIXEL_VARS.map((v) => [v, preset.vars[v] ?? DEFAULT_PIXEL_VARS[v]])))
              }
              title={preset.label}
              className="flex flex-col items-center gap-1 border-2 border-[var(--pixel-border)] p-2 opacity-70 hover:opacity-100 hover:border-[var(--pixel-primary)]"
            >
              <span className="text-lg">{preset.emoji}</span>
              <span className="font-mono text-[8px] uppercase text-[var(--pixel-text)]">{preset.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ALL_PIXEL_VARS.map((varKey) => (
            <label key={varKey} className="flex items-center gap-2 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">
              <input
                type="color"
                value={colors[varKey] ?? "#000000"}
                onChange={(e) => setColors((prev) => ({ ...prev, [varKey]: e.target.value }))}
                className="h-7 w-9 cursor-pointer border-2 border-[var(--pixel-border)] bg-transparent"
              />
              {PIXEL_VAR_LABELS[varKey] ?? varKey}
            </label>
          ))}
        </div>

        <label className="mb-1 block font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
          Imagem de fundo (opcional)
        </label>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer border-2 border-[var(--pixel-border)] px-3 py-2 font-mono text-[9px] uppercase text-[var(--pixel-text)] hover:bg-[var(--pixel-muted)]">
            {uploading ? "Enviando..." : "Enviar imagem"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          {bgUrl && (
            <button
              type="button"
              onClick={() => setBgUrl("")}
              className="border-2 border-[var(--pixel-border)] px-3 py-2 font-mono text-[9px] uppercase text-[var(--pixel-subtext)] hover:border-red-400 hover:text-red-400"
            >
              Remover imagem
            </button>
          )}
        </div>
        {bgUrl && (
          <div className="mb-4 h-20 w-full overflow-hidden border-2 border-[var(--pixel-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgUrl} alt="Pré-visualização" className="h-full w-full object-cover" />
          </div>
        )}

        <ColorSwatch colors={colors} />
        {extractMsg && <p className="mt-2 font-mono text-xs text-green-400">{extractMsg}</p>}

        <div className="mt-4 flex items-center gap-3">
          <PixelButton onClick={handleCreate} disabled={creating}>
            {creating ? "Salvando..." : "Salvar novo tema"}
          </PixelButton>
          {formError && <p className="font-mono text-xs text-red-400">{formError}</p>}
        </div>
      </PixelCard>

      <div>
        <p className="mb-3 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Meus temas salvos</p>
        {loading && <p className="font-mono text-xs text-[var(--pixel-subtext)]">Carregando...</p>}
        {listError && <p className="font-mono text-xs text-red-400">{listError}</p>}
        {!loading && themes.length === 0 && (
          <p className="font-mono text-xs text-[var(--pixel-subtext)]">Nenhum tema salvo ainda.</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {themes.map((theme) => (
            <PixelCard key={theme.id} className="space-y-2">
              <ColorSwatch colors={theme.colors} />
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-text)]">{theme.name}</p>
              <div className="flex flex-wrap gap-2">
                <PixelButton
                  variant="secondary"
                  className="px-2 py-1 text-[9px]"
                  onClick={() => void onApply(theme.id, theme.colors, theme.bgImageUrl)}
                >
                  Usar
                </PixelButton>
                <PixelButton
                  variant="ghost"
                  className="px-2 py-1 text-[9px]"
                  onClick={() => void handleTogglePublic(theme)}
                >
                  {theme.isPublic ? "Despublicar" : "Publicar na comunidade"}
                </PixelButton>
                <PixelButton
                  variant="destructive"
                  className="px-2 py-1 text-[9px]"
                  onClick={() => void handleDelete(theme)}
                >
                  Excluir
                </PixelButton>
              </div>
            </PixelCard>
          ))}
        </div>
      </div>
    </div>
  );
}

const COMMUNITY_PAGE_SIZE = 8;

function CommunityThemesTab({ onApply }: { onApply: ApplyFn }) {
  const [themes, setThemes] = useState<CommunityTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchCommunityThemes()
      .then((res) => setThemes(res.themes))
      .catch((err) => setListError(err instanceof Error ? err.message : "Erro ao carregar temas da comunidade."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="font-mono text-xs text-[var(--pixel-subtext)]">Carregando...</p>;
  if (listError) return <p className="font-mono text-xs text-red-400">{listError}</p>;
  if (themes.length === 0) {
    return <p className="font-mono text-xs text-[var(--pixel-subtext)]">Nenhum tema publicado pela comunidade ainda.</p>;
  }

  const query = search.trim().toLowerCase();
  const filtered = query
    ? themes.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.authorName.toLowerCase().includes(query) ||
          (t.authorUsername ?? "").toLowerCase().includes(query),
      )
    : themes;

  const totalPages = Math.max(1, Math.ceil(filtered.length / COMMUNITY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * COMMUNITY_PAGE_SIZE, currentPage * COMMUNITY_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Buscar por nome do tema ou autor..."
        className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] outline-none focus:border-[var(--pixel-primary)]"
      />

      {paginated.length === 0 ? (
        <p className="font-mono text-xs text-[var(--pixel-subtext)]">Nenhum tema encontrado para essa busca.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {paginated.map((theme) => (
            <PixelCard key={theme.id} className="space-y-2">
              {theme.bgImageUrl && (
                <div className="h-16 w-full overflow-hidden border-2 border-[var(--pixel-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={theme.bgImageUrl} alt={theme.name} className="h-full w-full object-cover" />
                </div>
              )}
              <ColorSwatch colors={theme.colors} />
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-text)]">{theme.name}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">
                por {theme.authorUsername ? `@${theme.authorUsername}` : theme.authorName}
              </p>
              <PixelButton
                variant="secondary"
                className="px-2 py-1 text-[9px]"
                onClick={() => void onApply(theme.id, theme.colors, theme.bgImageUrl)}
              >
                Usar este tema
              </PixelButton>
            </PixelCard>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
          <span>
            Pagina {currentPage} de {totalPages} ({filtered.length} temas)
          </span>
          <div className="flex gap-2">
            <PixelButton
              variant="ghost"
              className="px-2 py-1 text-[9px]"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </PixelButton>
            <PixelButton
              variant="ghost"
              className="px-2 py-1 text-[9px]"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Proxima
            </PixelButton>
          </div>
        </div>
      )}
    </div>
  );
}
