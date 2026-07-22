import { PixelCard } from "@/components/ui/pixel-card";
import { LeaderboardList, type LeaderboardListEntry } from "@/components/leaderboard/LeaderboardList";
import type { WeeklyChallengeData } from "@/features/arena/services/arena-api";

type Props = {
  data: WeeklyChallengeData;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function WeeklyChallengeCard({ data }: Props) {
  const { challenge, entry, leaderboard } = data;

  if (!challenge) {
    return (
      <PixelCard className="text-center">
        <p className="font-mono text-xs text-pixel-subtext">Nenhum desafio ativo no momento.</p>
      </PixelCard>
    );
  }

  const displayRank = entry?.rank ?? entry?.liveRank ?? null;

  const leaderboardEntries: LeaderboardListEntry[] = leaderboard.map(
    (item, idx): LeaderboardListEntry => ({
      id: item.userId,
      rank: item.rank ?? idx + 1,
      name: item.name,
      avatarUrl: item.avatarUrl,
      value: `${item.score} pts`,
      isCurrentUser: entry?.userId === item.userId,
    }),
  );

  // The user might be outside the visible top 10 — append their own row so they
  // can always see where they stand, with a divider marking the gap.
  const isInTop10 = entry ? leaderboard.some((item) => item.userId === entry.userId) : true;
  if (entry && !isInTop10) {
    leaderboardEntries.push({
      id: entry.userId,
      rank: displayRank,
      name: entry.name,
      avatarUrl: entry.avatarUrl,
      value: `${entry.score} pts`,
      isCurrentUser: true,
      showDividerBefore: true,
    });
  }

  return (
    <div className="space-y-4">
      <PixelCard>
        <p className="font-mono text-xs uppercase text-primary">{challenge.title || "Desafio da Semana"}</p>
        <p className="mt-1 font-mono text-[10px] text-pixel-subtext">
          {formatDate(challenge.weekStart)} — {formatDate(challenge.weekEnd)}
        </p>
        {entry && (
          <div className="mt-3 flex gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase text-pixel-subtext">Sua pontuação</p>
              <p className="font-mono text-lg font-bold text-[var(--pixel-accent)]">{entry.score}</p>
            </div>
            {displayRank !== null && (
              <div>
                <p className="font-mono text-[10px] uppercase text-pixel-subtext">
                  Ranking{entry.rank === null ? " (parcial)" : ""}
                </p>
                <p className="font-mono text-lg font-bold text-primary">#{displayRank}</p>
              </div>
            )}
          </div>
        )}
      </PixelCard>

      {leaderboardEntries.length > 0 && (
        <PixelCard>
          <p className="mb-3 font-mono text-[10px] uppercase text-pixel-subtext">Top 10</p>
          <LeaderboardList entries={leaderboardEntries} />
        </PixelCard>
      )}
    </div>
  );
}
