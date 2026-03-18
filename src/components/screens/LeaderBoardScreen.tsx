"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { PixelCard } from "@/components/ui/PixelCard";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeLeaderboard } from "@/hooks/useRealtimeLeaderboard";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; name: string; username: string | null; avatarUrl: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const data = (await response.json()) as { leaderboard?: LeaderboardEntry[]; error?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Erro ao carregar leaderboard.");
      }
      setEntries(data.leaderboard ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useRealtimeLeaderboard(() => {
    void loadLeaderboard();
  });

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchingUsers(true);
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(term)}&take=8`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          users?: Array<{ id: string; name: string; username: string | null; avatarUrl: string | null }>;
          error?: string;
        };

        if (!response.ok || data.error) {
          throw new Error(data.error ?? "Falha ao buscar usuarios.");
        }

        setSearchResults(data.users ?? []);
      } catch (searchError) {
        if (searchError instanceof Error && searchError.name === "AbortError") {
          return;
        }
        setSearchResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 xl:px-8">
        <div>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">Leaderboard</h1>
          <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Top 10 jogadores com mais XP acumulado
          </p>
        </div>

        <PixelCard className="space-y-3">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
            Buscar jogador por nome
          </p>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Digite pelo menos 2 caracteres"
            className="w-full border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] text-sm"
          />

          {searchTerm.trim().length > 0 && (
            <div className="space-y-2">
              {searchingUsers && (
                <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Buscando usuarios...</p>
              )}

              {!searchingUsers && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
                <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                  Nenhum usuario encontrado para esta busca.
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="grid gap-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => router.push(`/players/${result.id}`)}
                      className="flex items-center gap-3 border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-left hover:border-[var(--pixel-primary)]"
                    >
                      <div className="h-8 w-8 shrink-0 overflow-hidden border border-[var(--pixel-border)]">
                        {result.avatarUrl ? (
                          <Image
                            src={result.avatarUrl}
                            alt={result.name}
                            width={32}
                            height={32}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-[var(--font-pixel)] text-xs text-[var(--pixel-subtext)]">
                            {result.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-[var(--font-body)] text-sm">{result.name}</p>
                        <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                          @{result.username ?? "sem-username"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </PixelCard>

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
