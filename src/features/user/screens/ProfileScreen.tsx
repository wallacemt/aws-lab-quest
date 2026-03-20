"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AchievementsView } from "@/components/ui/achievements-view";
import { AppLayout } from "@/components/layout/AppLayout";
import { BadgesView } from "@/components/ui/badges-view";
import { UserProfileModal } from "@/components/ui/user-profile-modal";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { LevelBadge } from "@/components/ui/level-badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getProfileValidationError, sanitizeProfileInput } from "@/lib/input-validation";
import { getLevel, getLevelProgressPercent } from "@/lib/levels";
import { clearOnboardingStep, getOnboardingStep } from "@/lib/onboarding";
import { AchievementItem } from "@/lib/achievements";
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

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [levelBadges, setLevelBadges] = useState<LevelBadgeModel[]>([]);
  const [ownedBadgeIds, setOwnedBadgeIds] = useState<string[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [shareMsg, setShareMsg] = useState<{ message: string; type: "badge" | "achievement" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOnboardingProfile = getOnboardingStep() === "profile";

  // Keep onboarding flow forcing profile completion through modal.
  useEffect(() => {
    if (!hydrated) return;

    if (isOnboardingProfile) {
      setEditProfileOpen(true);
    }
  }, [hydrated, isOnboardingProfile]);

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

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((data: { achievements?: { items?: AchievementItem[] } }) => {
        setAchievements(data.achievements?.items ?? []);
      })
      .catch(() => void 0);
  }, []);

  async function handleCopyShareLink(type: "badge" | "achievement" = "badge", itemId: string) {
    if (!user?.id || !itemId) return;
    const url = `${window.location.origin}/share/${type}/${user.id}/${itemId}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg({ message: "Link copiado!", type });
      setTimeout(() => setShareMsg(null), 2500, type);
    } catch {
      setShareMsg({ message: "Nao foi possivel copiar o link.", type });
      setTimeout(() => setShareMsg(null), 2500);
    }
  }

  async function handleSave(nextDraft: {
    name: string;
    username: string;
    certification: string;
    certificationPresetCode: string;
    favoriteTheme: string;
  }) {
    const selectedCertificationName =
      certificationOptions.find((option) => option.code === nextDraft.certificationPresetCode)?.name ??
      nextDraft.certification;

    const nextProfile = sanitizeProfileInput({
      name: nextDraft.name,
      username: nextDraft.username,
      certification: selectedCertificationName,
      certificationPresetCode: nextDraft.certificationPresetCode,
      favoriteTheme: nextDraft.favoriteTheme,
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
      setEditProfileOpen(false);

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

  const currentLevel = getLevel(profile.totalXp ?? 0);
  const progress = getLevelProgressPercent(profile.totalXp ?? 0);
  const currentBadge = levelBadges.find((b) => b.level === currentLevel.number);

  if (!hydrated) {
    return (
      <AppLayout>
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
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
                <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-mono text-2xl text-[var(--pixel-subtext)]">
                  {(user?.name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 font-mono text-[9px] uppercase hover:bg-[var(--pixel-muted)] disabled:opacity-50"
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
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{user?.email}</p>
            <h2 className="font-sans text-2xl">@{profile.username || "Sem nome"}</h2>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <LevelBadge xp={profile.totalXp ?? 0} />
              <span className="font-mono text-[10px] uppercase">{profile.totalXp ?? 0} XP</span>
            </div>

            {/* XP progress bar */}
            <div className="mt-2 h-4 overflow-hidden border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-[2px]">
              <div className="h-full bg-[var(--pixel-primary)] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">
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
                  className="border-2 border-pixel-border overflow-hidden"
                >
                  <Image
                    src={currentBadge.imageUrl}
                    alt={`Badge ${currentBadge.name}`}
                    width={130}
                    height={130}
                    className="object-cover"
                  />
                </motion.div>
                <p className="mt-1 text-center font-mono text-[8px] uppercase text-[var(--pixel-subtext)]">
                  {currentBadge.name}
                </p>
                {ownedBadgeIds.includes(currentBadge.id) && user?.id && (
                  <div className="mt-2 text-center">
                    <button
                      onClick={() => handleCopyShareLink("badge", currentBadge.id)}
                      className="border border-pixel-border bg-pixel-card px-2 py-1 font-mono text-[0.4rem] uppercase hover:bg-muted"
                    >
                      Compartilhar Badge
                    </button>
                  </div>
                )}
                {shareMsg?.type === "badge" && (
                  <p className="mt-1 text-center font-mono text-[8px] uppercase text-accent">
                    {shareMsg.message}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </PixelCard>

        {/* Badges collection */}
        <PixelCard>
          <BadgesView xp={profile.totalXp ?? 0} levelBadges={levelBadges} />
        </PixelCard>

        {achievements.length > 0 && (
          <PixelCard>
            <AchievementsView items={achievements} handleCopyShareLink={handleCopyShareLink} shareMsg={shareMsg} />
          </PixelCard>
        )}

        {/* Edit form */}
        <PixelCard className="space-y-4">
          <h3 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Perfil</h3>

          {isOnboardingProfile && (
            <PixelCard className="space-y-3 border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">
                Etapa obrigatoria
              </p>
              <p className="font-sans text-sm leading-6 text-pixel-text">
                Complete nome, certificacao AWS alvo e tema favorito para liberar a Home e o restante da experiencia.
              </p>
            </PixelCard>
          )}

          <div className="space-y-2 font-sans text-sm leading-6 text-pixel-text">
            <p>
              <strong>Nome:</strong> {profile.name || "Nao definido"}
            </p>
            <p>
              <strong>Username:</strong> {profile.username ? `@${profile.username}` : "Nao definido"}
            </p>
            <p>
              <strong>Certificacao alvo:</strong> {profile.certification || "Nao definida"}
            </p>
            <p>
              <strong>Tema favorito:</strong> {profile.favoriteTheme || "Nao definido"}
            </p>
          </div>

          {needsCertificationReview && (
            <PixelCard className="border-yellow-500 bg-yellow-900/20 py-2">
              <p className="font-sans text-sm text-yellow-300">
                Nao conseguimos mapear automaticamente sua certificacao antiga. Selecione a certificacao alvo para
                concluir a migracao.
              </p>
            </PixelCard>
          )}

          {saveError && (
            <PixelCard className="border-red-500 bg-red-900/20 py-2">
              <p className="font-sans text-sm text-red-300">{saveError}</p>
            </PixelCard>
          )}

          <div className="flex items-center gap-3">
            <PixelButton onClick={() => setEditProfileOpen(true)} disabled={saving}>
              {isOnboardingProfile ? "Completar perfil" : "Editar perfil"}
            </PixelButton>
            {saveMsg && <span className="font-sans text-sm text-[var(--pixel-accent)]">{saveMsg}</span>}
          </div>
        </PixelCard>

        <UserProfileModal
          open={editProfileOpen}
          onClose={() => {
            if (!saving) {
              setEditProfileOpen(false);
            }
          }}
          profile={profile}
          currentUsername={profile.username}
          certificationOptions={certificationOptions}
          onSave={handleSave}
        />
      </main>
    </AppLayout>
  );
}
