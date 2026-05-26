"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { AchievementsView } from "@/components/ui/achievements-view";
import { AppLayout } from "@/components/layout/AppLayout";
import { BadgesView } from "@/components/ui/badges-view";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LevelBadge } from "@/components/ui/level-badge";
import { HistoryTabs } from "@/features/study/components/history/HistoryTabs";
import { QuestHistoryItem, StudyHistoryItem } from "@/features/study/services";
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


type CertBadge = {
  id: string;
  badgeUrl: string;
  badgeImageUrl: string | null;
  earnedAt: string;
  certificationPreset: { code: string; name: string } | null;
};

type PublicAchievements = {
  total: number;
  unlockedCount: number;
  items: AchievementItem[];
};

function TiltBadgeCard({ badge }: { badge: CertBadge }) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTilt({ x: dy * -12, y: dx * 12 });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  }, []);

  return (
    <motion.a
      ref={cardRef}
      href={badge.badgeUrl}
      target="_blank"
      rel="noopener noreferrer"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX: tilt.x, rotateY: tilt.y, scale: hovered ? 1.04 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="group relative flex items-center gap-3 overflow-hidden border border-amber-500/30 bg-amber-900/10 p-3 hover:border-amber-400/70"
    >
      {/* Sheen layer that follows tilt */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: hovered ? 0.12 : 0,
          background: `radial-gradient(circle at ${50 + tilt.y * 3}% ${50 + tilt.x * 3}%, rgba(251,191,36,0.9) 0%, transparent 70%)`,
        }}
      />

      {/* Badge image or fallback */}
      <div
        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-amber-500/40 bg-amber-900/30"
        style={{ transform: "translateZ(16px)" }}
      >
        {badge.badgeImageUrl ? (
          <Image
            src={badge.badgeImageUrl}
            alt={badge.certificationPreset?.name ?? "badge"}
            width={56}
            height={56}
            className="h-full w-full object-contain p-1 transition-transform duration-500 group-hover:scale-110"
            unoptimized
          />
        ) : (
          <span className="text-xl transition-transform duration-300 group-hover:scale-110">🎓</span>
        )}
        {/* Gloss overlay on the image */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1" style={{ transform: "translateZ(8px)" }}>
        <p className="truncate font-mono text-xs text-amber-300">
          {badge.certificationPreset?.name ?? badge.certificationPreset?.code ?? "Certificacao AWS"}
        </p>
        {badge.certificationPreset?.code && (
          <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">
            {badge.certificationPreset.code}
          </p>
        )}
        <p className="font-mono text-[9px] text-[var(--pixel-subtext)]">
          {new Date(badge.earnedAt).toLocaleDateString("pt-BR")}
        </p>
      </div>

      {/* External link icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 text-amber-500/50 transition-colors group-hover:text-amber-400"
        style={{ transform: "translateZ(8px)" }}
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </motion.a>
  );
}

export function PublicProfileScreen() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [user, setUser] = useState<PublicUser | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<PublicAchievements | null>(null);
  const [certBadges, setCertBadges] = useState<CertBadge[]>([]);
  const [levelBadges, setLevelBadges] = useState<LevelBadgeModel[]>([]);
  const [labHistory, setLabHistory] = useState<QuestHistoryItem[]>([]);
  const [studyHistory, setStudyHistory] = useState<StudyHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(true);

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
        setAchievements(userData.achievements ?? null);
        setCertBadges((userData.certBadges as CertBadge[]) ?? []);
        setLevelBadges(badgesData.badges ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

    fetch(`/api/users/${userId}?fullHistory=true`)
      .then((r) => r.json() as Promise<{ labHistory?: QuestHistoryItem[]; studyHistory?: StudyHistoryItem[] }>)
      .then((data) => {
        setLabHistory(data.labHistory ?? []);
        setStudyHistory(data.studyHistory ?? []);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <AppLayout>
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
        </main>
      </AppLayout>
    );
  }

  if (notFound || !user || !stats) {
    return (
      <AppLayout>
        <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-8">
          <p className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Jogador não encontrado</p>
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
                  <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-mono text-3xl text-[var(--pixel-subtext)]">
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
                <span className="font-mono text-[10px] uppercase">{totalXp} XP</span>
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
              <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">{currentLevel.next}</p>

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
                  <p className="mt-1 text-center font-mono text-[8px] uppercase text-[var(--pixel-subtext)]">
                    {currentBadge.name}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </PixelCard>
        </motion.div>

        {/* Real AWS Certifications */}
        {certBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.4 }}
          >
            <PixelCard className="space-y-4 border-amber-500/50 bg-amber-900/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <div>
                  <p className="font-mono text-[10px] uppercase text-amber-400">Certificacoes Conquistadas</p>
                  <p className="font-mono text-[9px] text-[var(--pixel-subtext)]">
                    Certificacoes AWS verificadas por este estudante
                  </p>
                </div>
                <span className="ml-auto border border-amber-500/50 bg-amber-900/20 px-2 py-0.5 font-mono text-[10px] text-amber-400">
                  {certBadges.length}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {certBadges.map((badge) => (
                  <TiltBadgeCard key={badge.id} badge={badge} />
                ))}
              </div>
            </PixelCard>
          </motion.div>
        )}

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
              <Collapsible open={achievementsOpen} onOpenChange={setAchievementsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-left"
                  >
                    <span className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">
                      Conquistas ({achievements.unlockedCount}/{achievements.total})
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${achievementsOpen ? "rotate-180" : "rotate-0"}`}
                      aria-hidden="true"
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="pt-3">
                  <ScrollArea className="h-[460px] pr-3">
                    <AchievementsView items={achievements.items}  isPublic />
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            </PixelCard>
          </motion.div>
        )}

        {/* Full history tabs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Historico de atividades</p>
            <HistoryTabs
              labHistory={labHistory}
              studyHistory={studyHistory}
              loading={historyLoading}
              readOnly
            />
          </PixelCard>
        </motion.div>
      </main>
    </AppLayout>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 border border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-0.5">
      <span className="font-mono text-[8px] uppercase text-[var(--pixel-subtext)]">{label}:</span>
      <span className="font-mono text-[8px] uppercase text-[var(--pixel-text)]">{value}</span>
    </div>
  );
}
