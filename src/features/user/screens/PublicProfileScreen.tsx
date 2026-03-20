"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { AchievementsView } from "@/components/ui/achievements-view";
import { AppLayout } from "@/components/layout/AppLayout";
import { BadgesView } from "@/components/ui/badges-view";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { LevelBadge } from "@/components/ui/level-badge";
import { AchievementItem } from "@/lib/achievements";
import { getLevel, getLevelProgressPercent } from "@/lib/levels";
import type { LevelBadge as LevelBadgeModel } from "@prisma/client";

type PublicUser = {
  id: string;
  name: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
  certification: string;
  favoriteTheme: string;
};

type UserStats = {
  totalXp: number;
  labsCompleted: number;
};

type HistoryEntry = {
  id: string;
  title: string;
  theme: string;
  xp: number;
  tasksCount: number;
  completedAt: string;
  certification: string;
};

type StudyEntry = {
  id: string;
  sessionType: "KC" | "SIMULADO";
  title: string;
  certificationCode: string | null;
  gainedXp: number;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
};

type PublicAchievements = {
  total: number;
  unlockedCount: number;
  items: AchievementItem[];
};

export function PublicProfileScreen() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [user, setUser] = useState<PublicUser | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [studyHistory, setStudyHistory] = useState<StudyEntry[]>([]);
  const [achievements, setAchievements] = useState<PublicAchievements | null>(null);
  const [levelBadges, setLevelBadges] = useState<LevelBadgeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;

    Promise.all([fetch(`/api/users/${userId}`).then((r) => r.json()), fetch("/api/badges").then((r) => r.json())])
      .then(([userData, badgesData]) => {
        if (userData.error) {
          setNotFound(true);
          return;
        }
        setUser(userData.user);
        setStats(userData.stats);
        setHistory(userData.history ?? []);
        setStudyHistory(userData.studyHistory ?? []);
        setAchievements(userData.achievements ?? null);
        setLevelBadges(badgesData.badges ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <AppLayout>
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
        </main>
      </AppLayout>
    );
  }

  if (notFound || !user || !stats) {
    return (
      <AppLayout>
        <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-8">
          <p className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">
            Jogador não encontrado
          </p>
          <PixelButton onClick={() => router.back()}>← Voltar</PixelButton>
        </main>
      </AppLayout>
    );
  }

  const totalXp = stats.totalXp;
  const currentLevel = getLevel(totalXp);
  const progress = getLevelProgressPercent(totalXp);
  const currentBadge = levelBadges.find((b) => b.level === currentLevel.number);
  const joinedYear = new Date(user.createdAt).getFullYear();

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 xl:px-8">
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <PixelButton variant="ghost" onClick={() => router.back()}>
            ← Voltar
          </PixelButton>
        </motion.div>

        {/* Player card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <PixelCard className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-24 w-24 overflow-hidden border-4 border-[var(--pixel-border)] shadow-[4px_4px_0_0_var(--pixel-shadow)]">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-[var(--font-pixel)] text-3xl text-[var(--pixel-subtext)]">
                    {(user.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <h1 className="font-[var(--font-body)] text-2xl">@{user.username}</h1>

              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <LevelBadge xp={totalXp} />
                <span className="font-[var(--font-pixel)] text-[10px] uppercase">{totalXp} XP</span>
              </div>

              {/* XP bar */}
              <div className="mt-2 h-4 overflow-hidden border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-[2px]">
                <motion.div
                  className="h-full bg-[var(--pixel-primary)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-subtext)]">
                {currentLevel.next}
              </p>

              {/* Meta info */}
              <div className="flex flex-wrap justify-center gap-3 pt-1 sm:justify-start">
                <StatPill label="Labs" value={String(stats.labsCompleted)} />
                {user.certification && <StatPill label="Cert. alvo" value={user.certification} />}
                {user.favoriteTheme && <StatPill label="Tema fav." value={user.favoriteTheme} />}
                <StatPill label="Desde" value={String(joinedYear)} />
              </div>
            </div>

            {/* Current badge animated */}
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
                        ? {
                            boxShadow: ["0 0 8px 2px #ffd70080", "0 0 24px 8px #ffd700cc", "0 0 8px 2px #ffd70080"],
                          }
                        : {
                            boxShadow: [
                              "0 0 0px 0px transparent",
                              "0 0 12px 4px var(--pixel-primary)",
                              "0 0 0px 0px transparent",
                            ],
                          }
                    }
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="overflow-hidden border-2 border-[var(--pixel-border)]"
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
        </motion.div>

        {/* Badges collection */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <PixelCard>
            <BadgesView xp={totalXp} levelBadges={levelBadges} />
          </PixelCard>
        </motion.div>

        {achievements && achievements.items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <PixelCard>
              <AchievementsView items={achievements.items} title="Conquistas" isPublic />
            </PixelCard>
          </motion.div>
        )}

        {/* Recent quests */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <PixelCard className="space-y-3">
              <h3 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">
                Últimos Labs ({history.length})
              </h3>
              <div className="space-y-2">
                {history.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04, duration: 0.25 }}
                    className="flex items-center justify-between border border-[var(--pixel-border)] bg-[var(--pixel-muted)]/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-[var(--font-body)] text-sm">{item.title}</p>
                      <p className="font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">
                        {item.theme} · {item.tasksCount} task{item.tasksCount !== 1 ? "s" : ""} ·{" "}
                        {new Date(item.completedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 border border-[var(--pixel-border)] px-2 py-0.5 font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-primary)]">
                      +{item.xp} XP
                    </span>
                  </motion.div>
                ))}
              </div>
            </PixelCard>
          </motion.div>
        )}

        {studyHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <PixelCard className="space-y-3">
              <h3 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">
                KC e Simulados ({studyHistory.length})
              </h3>
              <div className="space-y-2">
                {studyHistory.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.04, duration: 0.25 }}
                    className="flex items-center justify-between border border-[var(--pixel-border)] bg-[var(--pixel-muted)]/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-[var(--font-body)] text-sm">{item.title}</p>
                      <p className="font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">
                        {item.sessionType} · {item.scorePercent}% · {item.correctAnswers}/{item.totalQuestions} ·{" "}
                        {new Date(item.completedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 border border-[var(--pixel-border)] px-2 py-0.5 font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-primary)]">
                      +{item.gainedXp} XP
                    </span>
                  </motion.div>
                ))}
              </div>
            </PixelCard>
          </motion.div>
        )}
      </main>
    </AppLayout>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 border border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-0.5">
      <span className="font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">{label}:</span>
      <span className="font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-text)]">{value}</span>
    </div>
  );
}
