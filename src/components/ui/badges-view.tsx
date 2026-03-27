"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { LEVELS } from "@/lib/levels";
import type { LevelBadge } from "@prisma/client";

const TONE_GLOW: Record<string, string> = {
  base: "shadow-sky-500/60",
  "base-mid": "shadow-teal-500/60",
  mid: "shadow-violet-500/60",
  "mid-top": "shadow-red-500/60",
  top: "shadow-orange-500/60",
  legendary: "shadow-yellow-400/80",
};

const TONE_BORDER: Record<string, string> = {
  base: "border-sky-500",
  "base-mid": "border-teal-500",
  mid: "border-violet-500",
  "mid-top": "border-red-500",
  top: "border-orange-500",
  legendary: "border-yellow-400",
};

const TONE_TEXT: Record<string, string> = {
  base: "text-sky-400",
  "base-mid": "text-teal-400",
  mid: "text-violet-400",
  "mid-top": "text-red-400",
  top: "text-orange-400",
  legendary: "text-yellow-400",
};

interface BadgesViewProps {
  xp: number;
  levelBadges: LevelBadge[];
  ownedBadgeIds?: string[];
  onShareBadge?: (badgeId: string) => void | Promise<void>;
  shareMsg?: string | null;
}

export function BadgesView({ xp, levelBadges, ownedBadgeIds = [], onShareBadge, shareMsg = null }: BadgesViewProps) {
  const currentLevelNumber = [...LEVELS].reverse().find((l) => xp >= l.min)?.number ?? 1;
  const nextLevelNumber = currentLevelNumber < 6 ? currentLevelNumber + 1 : null;

  return (
    <div className="space-y-3">
      <h3 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Coleção de Badges</h3>
      {shareMsg && <p className="font-mono text-[8px] uppercase text-[var(--pixel-accent)]">{shareMsg}</p>}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {LEVELS.map((level) => {
          const badge = levelBadges.find((b) => b.level === level.number);
          const isUnlocked = xp >= level.min;
          const isNext = level.number === nextLevelNumber;
          const isFar = !isUnlocked && !isNext;
          const isLegendary = level.tone === "legendary";

          return (
            <BadgeCell
              key={level.number}
              level={level.number}
              name={level.name}
              minXp={level.min}
              tone={level.tone}
              imageUrl={badge?.imageUrl ?? null}
              isUnlocked={isUnlocked}
              isNext={isNext}
              isFar={isFar}
              isLegendary={isLegendary}
              currentXp={xp}
              canShare={Boolean(badge?.id && onShareBadge && ownedBadgeIds.includes(badge.id) && isUnlocked)}
              onShare={
                badge?.id && onShareBadge
                  ? () => {
                      void onShareBadge(badge.id);
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

interface BadgeCellProps {
  level: number;
  name: string;
  minXp: number;
  tone: string;
  imageUrl: string | null;
  isUnlocked: boolean;
  isNext: boolean;
  isFar: boolean;
  isLegendary: boolean;
  currentXp: number;
  canShare: boolean;
  onShare?: () => void;
}

function BadgeCell({
  level,
  name,
  minXp,
  tone,
  imageUrl,
  isUnlocked,
  isNext,
  isFar,
  isLegendary,
  currentXp,
  canShare,
  onShare,
}: BadgeCellProps) {
  const glowClass = TONE_GLOW[tone] ?? "shadow-white/20";
  const borderClass = TONE_BORDER[tone] ?? "border-white/20";
  const textClass = TONE_TEXT[tone] ?? "text-white/40";
  const xpNeeded = Math.max(0, minXp - currentXp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: level * 0.07, duration: 0.35, ease: "easeOut" }}
      className="group flex flex-col items-center gap-1"
    >
      {/* Badge image / placeholder */}
      <div className="relative">
        {/* Unlocked: full display with glow */}
        {isUnlocked && (
          <motion.div
            whileHover={{ scale: 1.08 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className={`relative border-2 ${borderClass} shadow-lg ${glowClass} overflow-hidden`}
          >
            {isLegendary && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-transparent to-yellow-400/20"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <BadgeImage imageUrl={imageUrl} name={name} level={level} size={80} />
          </motion.div>
        )}

        {/* Next to unlock: teaser with pulsing border + slight blur */}
        {isNext && (
          <motion.div
            className={`relative border-2 ${borderClass} overflow-hidden`}
            animate={{
              boxShadow: ["0 0 0px 0px transparent", `0 0 12px 3px var(--pixel-primary)`, "0 0 0px 0px transparent"],
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Question-mark overlay */}
            <div className="relative">
              <div className="blur-[3px] brightness-50">
                <BadgeImage imageUrl={imageUrl} name={name} level={level} size={80} />
              </div>
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="font-mono text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">?</span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Far / locked: fully hidden with lock icon */}
        {isFar && (
          <div className="border-2 border-[var(--pixel-border)] overflow-hidden opacity-30 grayscale">
            <BadgeImage imageUrl={imageUrl} name={name} level={level} size={80} />
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="text-lg">🔒</span>
            </div>
          </div>
        )}

        {canShare && onShare && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
            <button
              type="button"
              onClick={onShare}
              title="Compartilhar badge"
              aria-label="Compartilhar badge"
              className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 font-mono text-[8px] uppercase hover:bg-[var(--pixel-muted)]"
            >
              Link
            </button>
          </div>
        )}
      </div>

      {/* Label */}
      <p
        className={`font-mono text-[8px] uppercase leading-tight text-center ${
          isFar ? "text-[var(--pixel-subtext)] opacity-40" : isNext ? "text-[var(--pixel-subtext)]" : textClass
        }`}
      >
        {isFar ? `Lv.${level}` : name}
      </p>

      {/* XP requirement */}
      {!isUnlocked && !isFar && (
        <motion.p
          className="font-mono text-[7px] uppercase text-[var(--pixel-primary)]"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          -{xpNeeded} XP
        </motion.p>
      )}
      {!isUnlocked && isFar && (
        <p className="font-mono text-[7px] uppercase text-[var(--pixel-subtext)] opacity-30">{minXp} XP</p>
      )}
      {isUnlocked && <p className={`font-mono text-[7px] uppercase ${textClass}`}>✓ {minXp} XP</p>}
    </motion.div>
  );
}

function BadgeImage({
  imageUrl,
  name,
  level,
  size,
}: {
  imageUrl: string | null;
  name: string;
  level: number;
  size: number;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className="object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback: pixel art placeholder
  return (
    <div className="flex items-center justify-center bg-muted" style={{ width: size, height: size }}>
      <span className="font-mono text-xl font-bold text-pixel-subtext">{level}</span>
    </div>
  );
}
