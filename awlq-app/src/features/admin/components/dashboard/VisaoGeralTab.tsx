"use client";

import { useEffect, useState } from "react";
import { getAdminMetrics } from "@/features/admin/services/admin-api";
import { AdminMetricsPayload } from "@/features/admin/types";

type Props = { days: number; refreshKey: number };

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{title}</p>
      <p className="mt-2 font-mono text-lg uppercase text-[var(--pixel-primary)]">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-[var(--pixel-subtext)]">{subtitle}</p>}
    </div>
  );
}

function BarList({
  title,
  items,
  accent = "primary",
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  accent?: "primary" | "accent";
}) {
  const maxValue = items.reduce((acc, item) => Math.max(acc, item.count), 0);
  const colorClass = accent === "accent" ? "bg-[var(--pixel-accent)]" : "bg-[var(--pixel-primary)]";

  return (
    <div className="space-y-3 rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--pixel-subtext)]">Sem dados no periodo.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const widthPercent = maxValue > 0 ? Math.max(3, Math.round((item.count / maxValue) * 100)) : 0;
            return (
              <div key={`${title}-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-[var(--pixel-text)]">{item.label}</span>
                  <span className="font-mono text-[var(--pixel-subtext)]">{item.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
                  <div className={`h-full ${colorClass}`} style={{ width: `${widthPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimelineBars({ timeline }: { timeline: AdminMetricsPayload["timeline"] }) {
  const maxValue = timeline.reduce((acc, item) => Math.max(acc, item.users, item.sessions), 0);

  return (
    <div className="space-y-3 rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Timeline (usuarios x sessoes)</p>
      {timeline.length === 0 ? (
        <p className="text-xs text-[var(--pixel-subtext)]">Sem dados no periodo.</p>
      ) : (
        <div className="grid gap-2">
          {timeline.slice(-12).map((item) => {
            const usersWidth = maxValue > 0 ? Math.round((item.users / maxValue) * 100) : 0;
            const sessionsWidth = maxValue > 0 ? Math.round((item.sessions / maxValue) * 100) : 0;

            return (
              <div key={item.date} className="space-y-1">
                <p className="text-[10px] uppercase text-[var(--pixel-subtext)]">{item.date}</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-14 text-[var(--pixel-subtext)]">Users</span>
                    <div className="h-2 flex-1 overflow-hidden rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
                      <div className="h-full bg-[var(--pixel-primary)]" style={{ width: `${Math.max(usersWidth, 2)}%` }} />
                    </div>
                    <span className="w-7 text-right font-mono text-[var(--pixel-subtext)]">{item.users}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-14 text-[var(--pixel-subtext)]">Sessoes</span>
                    <div className="h-2 flex-1 overflow-hidden rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
                      <div className="h-full bg-[var(--pixel-accent)]" style={{ width: `${Math.max(sessionsWidth, 2)}%` }} />
                    </div>
                    <span className="w-7 text-right font-mono text-[var(--pixel-subtext)]">{item.sessions}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SystemHealthCard({ pendingTriggers }: { pendingTriggers: number }) {
  return (
    <div className="rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">System Health</p>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--pixel-text)]">Triggers pendentes</span>
          <span
            className={`font-mono ${pendingTriggers > 5 ? "text-[#fca5a5]" : "text-[#86efac]"}`}
          >
            {pendingTriggers}
          </span>
        </div>
      </div>
    </div>
  );
}

export function VisaoGeralTab({ days, refreshKey }: Props) {
  const [metrics, setMetrics] = useState<AdminMetricsPayload | null>(null);
  const [pendingTriggers, setPendingTriggers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [metricsData, healthRes] = await Promise.all([
          getAdminMetrics(days),
          fetch("/api/admin/system-health", { credentials: "include", cache: "no-store" }),
        ]);

        if (!cancelled) {
          setMetrics(metricsData);
          if (healthRes.ok) {
            const health = (await healthRes.json()) as { pendingTriggers: number };
            setPendingTriggers(health.pendingTriggers);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar metricas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [days, refreshKey]);

  if (loading) {
    return <p className="font-mono text-xs uppercase text-[#94a3b8]">Carregando...</p>;
  }

  if (error) {
    return <p className="text-sm text-[#fca5a5]">{error}</p>;
  }

  if (!metrics) return null;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Usuarios" value={String(metrics.overview.totals.users)} />
        <StatCard title="Questoes" value={String(metrics.overview.totals.questions)} />
        <StatCard title="Sessoes" value={String(metrics.overview.totals.studySessions)} />
        <StatCard
          title="Taxa de acerto"
          value={`${metrics.overview.averageScorePercent}%`}
          subtitle={`Aprovacao: ${metrics.overview.passRatePercent}%`}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <TimelineBars timeline={metrics.timeline} />
        <BarList
          title="Top servicos com maior erro"
          items={metrics.weakServices.map((item) => ({
            label: `${item.serviceCode} (${item.errorRate}%)`,
            count: item.errors,
          }))}
          accent="accent"
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <BarList title="Distribuicao por dificuldade" items={metrics.distribution.byDifficulty} />
        <BarList title="Distribuicao por uso" items={metrics.distribution.byUsage} />
        <BarList title="Distribuicao por certificacao" items={metrics.distribution.byCertification} />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <BarList
          title="Ranking XP"
          items={metrics.ranking.map((item) => ({ label: item.userName, count: item.totalXp }))}
          accent="accent"
        />
        <SystemHealthCard pendingTriggers={pendingTriggers} />
      </section>
    </div>
  );
}
