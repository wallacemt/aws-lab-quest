"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { fetchBosses, type BossWithBattle } from "@/features/arena/services/arena-api";
import Image from "next/image";
import { Sword } from "lucide-react";

type ArenaTab = "boss" | "derrotados";

export function BattleScreen() {
  const [bosses, setBosses] = useState<BossWithBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ArenaTab>("boss");

  useEffect(() => {
    fetchBosses()
      .then(setBosses)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao carregar bosses";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="grid min-h-[40vh] place-items-center">
          <p className="font-mono text-xs uppercase text-[var(--pixel-muted)]">Carregando arena...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <PixelCard className="border-red-500/40 bg-red-950/10">
            <p className="font-mono text-xs text-red-400">{error}</p>
          </PixelCard>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <PixelCard>
          <h1 className="font-mono text-sm uppercase text-primary">Arena de Batalha</h1>
          <p className="mt-1 font-[var(--font-body)] text-sm text-pixel-subtext">
            Escolha um boss para enfrentar e responda questões para reduzir seu HP.
          </p>
        </PixelCard>

        {bosses.length === 0 && (
          <PixelCard className="text-center">
            <p className="font-mono text-xs text-[var(--pixel-muted)]">
              Nenhum boss disponível ainda. O admin precisa cadastrar bosses na área de Arena para que os desafios
              apareçam aqui.
            </p>
          </PixelCard>
        )}

        {bosses.length > 0 && (
          <div className="flex gap-2 border-b-2 border-[var(--pixel-border)]">
            <button
              type="button"
              onClick={() => setTab("boss")}
              className={`px-4 py-2 font-mono text-xs uppercase ${
                tab === "boss"
                  ? "border-b-2 border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                  : "text-[var(--pixel-subtext)]"
              }`}
            >
              Boss
            </button>
            <button
              type="button"
              onClick={() => setTab("derrotados")}
              className={`px-4 py-2 font-mono text-xs uppercase ${
                tab === "derrotados"
                  ? "border-b-2 border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                  : "text-[var(--pixel-subtext)]"
              }`}
            >
              Derrotados
            </button>
          </div>
        )}

        {(() => {
          const visibleBosses = bosses.filter((boss) => (tab === "derrotados" ? boss.defeated : !boss.defeated));

          if (bosses.length > 0 && visibleBosses.length === 0) {
            return (
              <PixelCard className="text-center">
                <p className="font-mono text-xs text-[var(--pixel-muted)]">
                  {tab === "derrotados" ? "Nenhum boss derrotado ainda." : "Todos os bosses foram derrotados!"}
                </p>
              </PixelCard>
            );
          }

          return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBosses.map((boss) => {
                const battle = boss.currentBattle;
                const hpPct = battle ? Math.round((battle.remainingHp / boss.maxHp) * 100) : 100;
                const hpColor = hpPct > 60 ? "bg-[var(--pixel-accent)]" : hpPct > 30 ? "bg-yellow-500" : "bg-red-500";

                return (
                  <PixelCard key={boss.id} className="flex items-center flex-col gap-3  overflow-hidden ">
                    {/* Artwork */}
                    <div className="border-2 relative md:w-full  w-50 h-50  md:h-72 ">
                      {boss.artworkUrl ? (
                        <Image
                          src={boss.artworkUrl}
                          alt={boss.name}
                          fill
                          className={`object-cover ${boss.defeated ? "grayscale" : ""}`}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center border-b border-[var(--pixel-border)] bg-[var(--pixel-border)]/20 font-mono text-4xl text-[var(--pixel-primary)]">
                          <Sword size={100} />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 p-4">
                      {/* Boss info */}
                      <div>
                        <p className="font-mono text-sm font-semibold text-[var(--pixel-text)]">{boss.name}</p>
                        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                          {boss.themeService}
                        </p>
                      </div>

                      {/* HP bar */}
                      {battle && !boss.defeated && (
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px] text-[var(--pixel-subtext)]">
                            <span>HP restante</span>
                            <span>
                              {battle.remainingHp} / {boss.maxHp}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-[var(--pixel-border)]">
                            <div className={`h-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
                          </div>
                        </div>
                      )}

                      <Link href={boss.defeated ? `/arena/${boss.id}/revisao` : `/arena/${boss.id}`} className="block">
                        <PixelButton className="w-full text-xs" variant={boss.defeated ? "ghost" : "primary"}>
                          {boss.defeated ? "Ver revisão" : battle ? "Continuar batalha" : "Iniciar batalha"}
                        </PixelButton>
                      </Link>
                    </div>
                  </PixelCard>
                );
              })}
            </div>
          );
        })()}
      </div>
    </AppLayout>
  );
}
