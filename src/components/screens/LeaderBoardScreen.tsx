"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { PixelCard } from "@/components/ui/PixelCard";
import { useAuth } from "@/hooks/useAuth";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  totalXp: number;
  labsCompleted: number;
  isCurrentUser: boolean;
};

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderBoardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data: { leaderboard?: LeaderboardEntry[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setEntries(data.leaderboard ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar leaderboard."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 xl:px-8">
        <div>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">Leaderboard</h1>
          <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Top 10 jogadores com mais XP acumulado
          </p>
        </div>

        {loading && (
          <PixelCard>
            <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
          </PixelCard>
        )}

        {error && (
          <PixelCard className="border-red-500 bg-red-900/20">
            <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
          </PixelCard>
        )}

        {!loading && !error && entries.length === 0 && (
          <PixelCard className="py-12 text-center">
            <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">
              Nenhum jogador no ranking ainda.
            </p>
            <p className="mt-3 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Complete labs para entrar no ranking!
            </p>
          </PixelCard>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => {
              const isMe = entry.isCurrentUser;
              const medal = MEDAL[entry.rank];

              return (
                <PixelCard
                  key={entry.userId}
                  onClick={() => router.push(`/players/${entry.userId}`)}
                  className={`flex cursor-pointer items-center gap-4 py-3 transition-colors hover:border-[var(--pixel-primary)] hover:bg-[var(--pixel-primary)]/5 ${
                    isMe ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10" : ""
                  }`}
                >
                  {/* Rank */}
                  <div className="flex w-10 shrink-0 items-center justify-center text-center">
                    {medal ? (
                      <span className="text-2xl leading-none">{medal}</span>
                    ) : (
                      <span className="font-[var(--font-pixel)] text-sm text-[var(--pixel-subtext)]">
                        #{entry.rank}
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
                      <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-[var(--font-pixel)] text-sm text-[var(--pixel-subtext)]">
                        {entry.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[var(--font-body)] text-base">
                      @{entry.username}
                      {isMe && (
                        <span className="ml-2 font-[var(--font-pixel)] text-[9px] uppercase text-[var(--pixel-primary)]">
                          você
                        </span>
                      )}
                    </p>
                    <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                      {entry.labsCompleted} lab{entry.labsCompleted !== 1 ? "s" : ""} completo
                      {entry.labsCompleted !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* XP */}
                  <div className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                    <span className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
                      {entry.totalXp} XP
                    </span>
                  </div>
                </PixelCard>
              );
            })}
          </div>
        )}

        {!loading && user && !entries.find((e) => e.isCurrentUser) && entries.length > 0 && (
          <PixelCard className="border-dashed py-3 text-center">
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Você ainda não está no Top 10. Continue completando labs!
            </p>
          </PixelCard>
        )}
      </main>
    </AppLayout>
  );
}
