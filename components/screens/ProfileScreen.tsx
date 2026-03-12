"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BadgesView } from "@/components/BadgesView";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getLevel, getLevelProgressPercent } from "@/lib/levels";
import type { LevelBadge as LevelBadgeModel } from "@prisma/client";

export function ProfileScreen() {
  const { user } = useAuth();
  const { profile, setProfile, hydrated, avatarUrl, setAvatarUrl } = useUserProfile();

  const [name, setName] = useState("");
  const [certification, setCertification] = useState("");
  const [favoriteTheme, setFavoriteTheme] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [levelBadges, setLevelBadges] = useState<LevelBadgeModel[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local form state when profile loads
  useEffect(() => {
    if (!hydrated) return;
    setName(profile.name);
    setCertification(profile.certification);
    setFavoriteTheme(profile.favoriteTheme);
  }, [hydrated, profile]);

  // Fetch total XP from history
  useEffect(() => {
    fetch("/api/quest-history")
      .then((r) => r.json())
      .then((data: { history?: { xp: number }[] }) => {
        const xp = (data.history ?? []).reduce((sum, item) => sum + item.xp, 0);
        setTotalXp(xp);
      })
      .catch(() => void 0);
  }, []);

  // Fetch level badges
  useEffect(() => {
    fetch("/api/badges")
      .then((r) => r.json())
      .then((data: { badges?: LevelBadgeModel[] }) => {
        setLevelBadges(data.badges ?? []);
      })
      .catch(() => void 0);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    await setProfile({ name, certification, favoriteTheme });
    setSaving(false);
    setSaveMsg("Perfil salvo!");
    setTimeout(() => setSaveMsg(null), 2500);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarLoading(true);
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      const data = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload falhou.");
      setAvatarUrl(data.avatarUrl!);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro no upload.");
    } finally {
      setAvatarLoading(false);
    }
  }

  const currentLevel = getLevel(totalXp);
  const progress = getLevelProgressPercent(totalXp);
  const currentBadge = levelBadges.find((b) => b.level === currentLevel.number);

  if (!hydrated) {
    return (
      <AppLayout>
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 xl:px-8">
        {/* Player card */}
        <PixelCard className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="relative flex shrink-0 flex-col items-center gap-2">
            <div className="h-24 w-24 overflow-hidden border-4 border-[var(--pixel-border)] shadow-[4px_4px_0_0_var(--pixel-shadow)]">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" width={96} height={96} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-[var(--font-pixel)] text-2xl text-[var(--pixel-subtext)]">
                  {(user?.name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 font-[var(--font-pixel)] text-[9px] uppercase hover:bg-[var(--pixel-muted)] disabled:opacity-50"
            >
              {avatarLoading ? "Enviando..." : "Trocar Foto"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Player info */}
          <div className="flex-1 space-y-1 text-center sm:text-left">
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">{user?.email}</p>
            <h2 className="font-[var(--font-body)] text-2xl font-bold">{profile.name || "Sem nome"}</h2>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <LevelBadge xp={totalXp} />
              <span className="font-[var(--font-pixel)] text-[10px] uppercase">{totalXp} XP</span>
            </div>

            {/* XP progress bar */}
            <div className="mt-2 h-4 overflow-hidden border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-[2px]">
              <div className="h-full bg-[var(--pixel-primary)] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-subtext)]">
              {currentLevel.next}
            </p>
          </div>

          {/* Level badge image — animated */}
          <AnimatePresence>
            {currentBadge?.imageUrl && (
              <motion.div
                key={currentBadge.level}
                className="shrink-0"
                initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                whileHover={{ scale: 1.12, rotate: 3 }}
              >
                <motion.div
                  animate={
                    currentLevel.tone === "legendary"
                      ? { boxShadow: ["0 0 8px 2px #ffd70080", "0 0 24px 8px #ffd700cc", "0 0 8px 2px #ffd70080"] }
                      : {
                          boxShadow: [
                            "0 0 0px 0px transparent",
                            "0 0 12px 4px var(--pixel-primary)",
                            "0 0 0px 0px transparent",
                          ],
                        }
                  }
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="border-2 border-[var(--pixel-border)] overflow-hidden"
                >
                  <Image
                    src={currentBadge.imageUrl}
                    alt={`Badge ${currentBadge.name}`}
                    width={88}
                    height={88}
                    className="object-cover"
                  />
                </motion.div>
                <p className="mt-1 text-center font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">
                  {currentBadge.name}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </PixelCard>

        {/* Badges collection */}
        <PixelCard>
          <BadgesView xp={totalXp} levelBadges={levelBadges} />
        </PixelCard>

        {/* Edit form */}
        <PixelCard className="space-y-4">
          <h3 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">Editar Perfil</h3>

          <label className="block font-[var(--font-body)] text-sm font-semibold">
            Nome de jogador
            <input
              type="text"
              className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="block font-[var(--font-body)] text-sm font-semibold">
            Certificação AWS alvo
            <input
              type="text"
              placeholder="ex: AWS Solutions Architect Associate"
              className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
              value={certification}
              onChange={(e) => setCertification(e.target.value)}
            />
          </label>

          <label className="block font-[var(--font-body)] text-sm font-semibold">
            Tema favorito para quests
            <input
              type="text"
              placeholder="ex: games, anime, música..."
              className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
              value={favoriteTheme}
              onChange={(e) => setFavoriteTheme(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-3">
            <PixelButton onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Perfil"}
            </PixelButton>
            {saveMsg && <span className="font-[var(--font-body)] text-sm text-[var(--pixel-accent)]">{saveMsg}</span>}
          </div>
        </PixelCard>
      </main>
    </AppLayout>
  );
}
