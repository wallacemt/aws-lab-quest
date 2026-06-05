"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchBosses, type BossWithBattle } from "@/features/arena/services/arena-api";

export function BattleScreen() {
  const [bosses, setBosses] = useState<BossWithBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <p className="font-mono text-xs uppercase text-[var(--pixel-muted)]">
            Carregando arena...
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="border border-red-500/30 bg-red-950/20 p-6">
            <p className="font-mono text-xs text-red-400">{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div>
          <h1 className="font-mono text-lg font-bold uppercase text-[var(--pixel-primary)]">
            Arena de Batalha
          </h1>
          <p className="mt-1 font-mono text-xs text-[var(--pixel-muted)]">
            Escolha um boss para enfrentar
          </p>
        </div>

        {bosses.length === 0 && (
          <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-6 text-center">
            <p className="font-mono text-xs text-[var(--pixel-muted)]">
              Nenhum boss disponível ainda. O admin precisa cadastrar bosses na área de Arena para
              que os desafios apareçam aqui.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bosses.map((boss) => {
            const battle = boss.currentBattle;
            const hpPct = battle ? Math.round((battle.remainingHp / boss.maxHp) * 100) : 100;

            return (
              <div
                key={boss.id}
                className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-4 space-y-3"
              >
                {boss.artworkUrl ? (
                  <img
                    src={boss.artworkUrl}
                    alt={boss.name}
                    className="h-32 w-full rounded object-cover"
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center rounded border border-[var(--pixel-border)] bg-[var(--pixel-border)]/30 font-mono text-4xl text-[var(--pixel-primary)]">
                    B
                  </div>
                )}

                <div>
                  <p className="font-mono text-sm font-semibold text-[var(--pixel-text)]">
                    {boss.name}
                  </p>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">
                    {boss.themeService}
                  </p>
                </div>

                {battle && (
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[10px] text-[var(--pixel-muted)]">
                      <span>HP restante</span>
                      <span>
                        {battle.remainingHp} / {boss.maxHp}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-[var(--pixel-border)]">
                      <div
                        className="h-full rounded bg-[#22c55e] transition-all"
                        style={{ width: `${hpPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <Link
                  href={`/arena/${boss.id}`}
                  className="block w-full border border-[var(--pixel-primary)] px-3 py-2 text-center font-mono text-xs uppercase text-[var(--pixel-primary)] transition-colors hover:bg-[var(--pixel-primary)]/10"
                >
                  {battle ? "Continuar batalha" : "Iniciar batalha"}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
