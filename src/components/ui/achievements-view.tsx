"use client";

import Image from "next/image";
import { AchievementItem } from "@/lib/achievements";
import { PixelButton } from "./pixel-button";

type AchievementsViewProps = {
  items: AchievementItem[];
  title?: string;
  handleCopyShareLink?: (type: "badge" | "achievement" | undefined, itemId: string) => Promise<void>;
  shareMsg?: { message: string; type: "badge" | "achievement" } | null;
  isPublic?: boolean;
};

function rarityClass(rarity: AchievementItem["rarity"]): string {
  switch (rarity) {
    case "legendary":
      return "border-yellow-400 text-yellow-300";
    case "epic":
      return "border-fuchsia-400 text-fuchsia-300";
    case "rare":
      return "border-sky-400 text-sky-300";
    case "uncommon":
      return "border-emerald-400 text-emerald-300";
    default:
      return "border-[var(--pixel-border)] text-[var(--pixel-subtext)]";
  }
}

export function AchievementsView({
  items,
  title = "Conquistas",
  handleCopyShareLink,
  shareMsg,
  isPublic,
}: AchievementsViewProps) {
  const unlockedCount = items.filter((item) => item.unlocked).length;

  return (
    <div className="space-y-3">
      <h3 className="font-mono text-xs uppercase text-primary">
        {title} ({unlockedCount}/{items.length})
      </h3>

      <div className="grid gap-2 sm:grid-cols-2">
        {items
          .filter((i) => i.unlocked)
          .map((item) => (
            <div
              key={item.code}
              className={`space-y-2 border-2 retro-shadow px-3 py-2 ${rarityClass(item.rarity)} ${item.unlocked ? "bg-pixel-card" : "bg-muted/30 opacity-70"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase">{item.name}</p>
                <span className="font-mono text-[8px] uppercase ">{item.rarity}</span>
              </div>

              <p className="font-sans text-center text-xs text-pixel-text">{item.description}</p>

              <div className="relative flex items-center justify-center mx-auto h-40 w-40 overflow-hidden border-2 border-[var(--pixel-border)]">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    width={80}
                    height={80}
                    className={`h-full w-full object-cover ${item.unlocked ? "" : "grayscale opacity-40 blur-[1px]"}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted font-mono text-[8px] uppercase text-[var(--pixel-subtext)]">
                    sem arte
                  </div>
                )}
                {!item.unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-base">🔒</div>
                )}
              </div>

              {item.unlocked ? (
                <div className="space-y-2 flex items-center flex-col justify-center">
                  <p className="font-mono text-[8px] uppercase text-[var(--pixel-accent)]">
                    Desbloqueada {item.unlockedAt ? new Date(item.unlockedAt).toLocaleDateString("pt-BR") : ""}
                  </p>
                  {!isPublic && (
                    <>
                      <PixelButton
                        type="button"
                        onClick={() => handleCopyShareLink && handleCopyShareLink("achievement", item.id)}
                      >
                        Compartilhar conquista
                      </PixelButton>
                      {shareMsg && (
                        <p className="mt-1 text-center font-mono text-[8px] uppercase text-accent">
                          {shareMsg.message}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
                    <div className="h-full bg-[var(--pixel-primary)]" style={{ width: `${item.progressPercent}%` }} />
                  </div>
                  <p className="font-mono text-[8px] uppercase text-[var(--pixel-subtext)]">
                    {item.current}/{item.target} ({item.progressPercent}%)
                  </p>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
