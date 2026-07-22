import Image from "next/image";
import { PixelCard } from "@/components/ui/pixel-card";

export type LeaderboardListEntry = {
  id: string;
  rank: number | null;
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  value: string;
  isCurrentUser?: boolean;
  /** Renders a "..." divider above this row — for a gap between the visible top N and the current user's own row. */
  showDividerBefore?: boolean;
};

type Props = {
  entries: LeaderboardListEntry[];
  onEntryClick?: (entry: LeaderboardListEntry) => void;
};

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardList({ entries, onEntryClick }: Props) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const medal = entry.rank ? MEDAL[entry.rank] : undefined;

        return (
          <div key={entry.id}>
            {entry.showDividerBefore && (
              <div className="py-1 text-center font-mono text-xs text-[var(--pixel-subtext)]">···</div>
            )}
            <PixelCard
              onClick={onEntryClick ? () => onEntryClick(entry) : undefined}
              className={`flex items-center gap-4 py-3 transition-colors ${
                onEntryClick ? "cursor-pointer hover:border-[var(--pixel-primary)] hover:bg-[var(--pixel-primary)]/5" : ""
              } ${entry.isCurrentUser ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10" : ""}`}
            >
              {/* Rank */}
              <div className="flex w-10 shrink-0 items-center justify-center text-center">
                {medal ? (
                  <span className="text-2xl leading-none">{medal}</span>
                ) : (
                  <span className="font-mono text-sm text-[var(--pixel-subtext)]">
                    {entry.rank !== null ? `#${entry.rank}` : "—"}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="h-10 w-10 shrink-0 overflow-hidden border-2 border-[var(--pixel-border)]">
                {entry.avatarUrl ? (
                  <Image
                    src={entry.avatarUrl}
                    alt={entry.name}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-mono text-sm text-[var(--pixel-subtext)]">
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-[var(--font-body)] text-base">
                  {entry.name}
                  {entry.isCurrentUser && (
                    <span className="ml-2 font-mono text-[9px] uppercase text-[var(--pixel-primary)]">você</span>
                  )}
                </p>
                {entry.subtitle && (
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{entry.subtitle}</p>
                )}
              </div>

              {/* Value */}
              <div className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                <span className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">{entry.value}</span>
              </div>
            </PixelCard>
          </div>
        );
      })}
    </div>
  );
}
