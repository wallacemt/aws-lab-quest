"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { BadgesView } from "@/components/BadgesView";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getProfileValidationError, sanitizeProfileInput } from "@/lib/input-validation";
import { getLevel, getLevelProgressPercent } from "@/lib/levels";
import { clearOnboardingStep, getOnboardingStep } from "@/lib/onboarding";
import type { LevelBadge as LevelBadgeModel } from "@prisma/client";

export function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    profile,
    setProfile,
    hydrated,
    avatarUrl,
    setAvatarUrl,
    certificationOptions,
    needsCertificationReview,
    setNeedsCertificationReview,
  } = useUserProfile();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [certification, setCertification] = useState("");
  const [certificationPresetCode, setCertificationPresetCode] = useState("");
  const [favoriteTheme, setFavoriteTheme] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [levelBadges, setLevelBadges] = useState<LevelBadgeModel[]>([]);
  const [ownedBadgeIds, setOwnedBadgeIds] = useState<string[]>([]);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOnboardingProfile = getOnboardingStep() === "profile";

  // Sync local form state when profile loads
  useEffect(() => {
    if (!hydrated) return;
    setName(profile.name);
    setUsername(profile.username);
    setCertification(profile.certification);
    setCertificationPresetCode(profile.certificationPresetCode);
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
      .then((data: { badges?: LevelBadgeModel[]; ownedBadgeIds?: string[] }) => {
        setLevelBadges(data.badges ?? []);
        setOwnedBadgeIds(data.ownedBadgeIds ?? []);
      })
      .catch(() => void 0);
  }, []);

  async function handleCopyShareLink() {
    if (!user?.id || !currentBadge?.id) return;
    const url = `${window.location.origin}/share/badge/${user.id}/${currentBadge.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copiado!");
      setTimeout(() => setShareMsg(null), 2500);
    } catch {
      setShareMsg("Nao foi possivel copiar o link.");
      setTimeout(() => setShareMsg(null), 2500);
    }
  }

  async function handleSave() {
    const selectedCertificationName =
      certificationOptions.find((option) => option.code === certificationPresetCode)?.name ?? certification;

    const nextProfile = sanitizeProfileInput({
      name,
      username,
      certification: selectedCertificationName,
      certificationPresetCode,
      favoriteTheme,
    });
    const validationError = getProfileValidationError(nextProfile);

    if (validationError) {
      setSaveError(validationError);
      setSaveMsg(null);
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);

    const onboardingStep = getOnboardingStep();

    try {
      await setProfile(nextProfile);
      setNeedsCertificationReview(false);
      setSaveMsg(isOnboardingProfile ? "Perfil concluido!" : "Perfil salvo!");

      if (onboardingStep) {
        clearOnboardingStep();
        router.replace("/");
        return;
      }

      setTimeout(() => setSaveMsg(null), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Nao foi possivel salvar o perfil.");
    } finally {
      setSaving(false);
    }
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
            <h2 className="font-[var(--font-body)] text-2xl">@{profile.username || "Sem nome"}</h2>
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
                    width={120}
                    height={120}
                    className="object-cover"
                  />
                </motion.div>
                <p className="mt-1 text-center font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">
                  {currentBadge.name}
                </p>
                {ownedBadgeIds.includes(currentBadge.id) && user?.id && (
                  <div className="mt-2 text-center">
                    <button
                      onClick={handleCopyShareLink}
                      className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 font-[var(--font-pixel)] text-[8px] uppercase hover:bg-[var(--pixel-muted)]"
                    >
                      Compartilhar Badge
                    </button>
                  </div>
                )}
                {shareMsg && (
                  <p className="mt-1 text-center font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-accent)]">
                    {shareMsg}
                  </p>
                )}
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

          {isOnboardingProfile && (
            <PixelCard className="space-y-3 border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10">
              <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
                Etapa obrigatoria
              </p>
              <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
                Complete nome, certificacao AWS alvo e tema favorito para liberar a Home e o restante da experiencia.
              </p>
            </PixelCard>
          )}

          <label className="block font-[var(--font-body)] text-sm">
            Nome de jogador *
            <input
              type="text"
              required
              className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="block font-[var(--font-body)] text-sm">
            Nome de usuario *
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                required
                className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] lowercase focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: cloud_runner_123"
              />
              <PixelButton
                type="button"
                variant="ghost"
                onClick={async () => {
                  const response = await fetch("/api/user/username", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ random: true }),
                  });

                  const data = (await response.json()) as { username?: string; error?: string };
                  if (!response.ok || !data.username) {
                    setSaveError(data.error ?? "Nao foi possivel gerar username.");
                    return;
                  }

                  setUsername(data.username);
                  setSaveError(null);
                }}
              >
                Gerar
              </PixelButton>
            </div>
            <p className="mt-1 font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">
              Use de 3 a 24 caracteres: letras, numeros ou _
            </p>
          </label>

          <label className="block font-[var(--font-body)] text-sm">
            Certificacao AWS alvo *
            <select
              required
              className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
              value={certificationPresetCode}
              onChange={(e) => {
                const code = e.target.value;
                const selected = certificationOptions.find((option) => option.code === code);
                setCertificationPresetCode(code);
                setCertification(selected?.name ?? "");
              }}
            >
              <option value="">Selecione uma certificacao</option>
              {certificationOptions.map((option) => (
                <option key={option.id} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          {needsCertificationReview && (
            <PixelCard className="border-yellow-500 bg-yellow-900/20 py-2">
              <p className="font-[var(--font-body)] text-sm text-yellow-300">
                Nao conseguimos mapear automaticamente sua certificacao antiga. Selecione a certificacao alvo para
                concluir a migracao.
              </p>
            </PixelCard>
          )}

          <label className="block font-[var(--font-body)] text-sm">
            Tema favorito para quests *
            <input
              type="text"
              required
              placeholder="ex: games, anime, música..."
              className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
              value={favoriteTheme}
              onChange={(e) => setFavoriteTheme(e.target.value)}
            />
          </label>

          {saveError && (
            <PixelCard className="border-red-500 bg-red-900/20 py-2">
              <p className="font-[var(--font-body)] text-sm text-red-300">{saveError}</p>
            </PixelCard>
          )}

          <div className="flex items-center gap-3">
            <PixelButton onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : isOnboardingProfile ? "Salvar e entrar" : "Salvar Perfil"}
            </PixelButton>
            {saveMsg && <span className="font-[var(--font-body)] text-sm text-[var(--pixel-accent)]">{saveMsg}</span>}
          </div>
        </PixelCard>
      </main>
    </AppLayout>
  );
}
