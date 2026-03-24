"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { getAdminMetrics, getAdminStatus } from "@/features/admin/services/admin-api";
import { AdminMetricsPayload, AdminStatus } from "@/features/admin/types";

function StatCard(props: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{props.title}</p>
      <p className="mt-2 font-mono text-lg uppercase text-[var(--pixel-primary)]">{props.value}</p>
      {props.subtitle && <p className="mt-1 text-xs text-[var(--pixel-subtext)]">{props.subtitle}</p>}
    </div>
  );
}

function BarList(props: {
  title: string;
  items: Array<{ label: string; count: number }>;
  accent?: "primary" | "accent";
}) {
  const maxValue = props.items.reduce((acc, item) => Math.max(acc, item.count), 0);
  const colorClass = props.accent === "accent" ? "bg-[var(--pixel-accent)]" : "bg-[var(--pixel-primary)]";

  return (
    <div className="space-y-3 rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{props.title}</p>
      {props.items.length === 0 ? (
        <p className="text-xs text-[var(--pixel-subtext)]">Sem dados no periodo.</p>
      ) : (
        <div className="space-y-2">
          {props.items.map((item) => {
            const widthPercent = maxValue > 0 ? Math.max(3, Math.round((item.count / maxValue) * 100)) : 0;
            return (
              <div key={`${props.title}-${item.label}`} className="space-y-1">
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

function TimelineBars(props: { timeline: AdminMetricsPayload["timeline"] }) {
  const maxValue = props.timeline.reduce((acc, item) => Math.max(acc, item.users, item.sessions), 0);

  return (
    <div className="space-y-3 rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Timeline (usuarios x sessoes)</p>
      {props.timeline.length === 0 ? (
        <p className="text-xs text-[var(--pixel-subtext)]">Sem dados no periodo.</p>
      ) : (
        <div className="grid gap-2">
          {props.timeline.slice(-12).map((item) => {
            const usersWidth = maxValue > 0 ? Math.round((item.users / maxValue) * 100) : 0;
            const sessionsWidth = maxValue > 0 ? Math.round((item.sessions / maxValue) * 100) : 0;

            return (
              <div key={item.date} className="space-y-1">
                <p className="text-[10px] uppercase text-[var(--pixel-subtext)]">{item.date}</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-14 text-[var(--pixel-subtext)]">Users</span>
                    <div className="h-2 flex-1 overflow-hidden rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
                      <div
                        className="h-full bg-[var(--pixel-primary)]"
                        style={{ width: `${Math.max(usersWidth, 2)}%` }}
                      />
                    </div>
                    <span className="w-7 text-right font-mono text-[var(--pixel-subtext)]">{item.users}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-14 text-[var(--pixel-subtext)]">Sessoes</span>
                    <div className="h-2 flex-1 overflow-hidden rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
                      <div
                        className="h-full bg-[var(--pixel-accent)]"
                        style={{ width: `${Math.max(sessionsWidth, 2)}%` }}
                      />
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

export function AdminDashboardScreen() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [metrics, setMetrics] = useState<AdminMetricsPayload | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [statusData, metricsData] = await Promise.all([getAdminStatus(), getAdminMetrics(days)]);
        setStatus(statusData);
        setMetrics(metricsData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao validar acesso admin.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [days]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <PixelCard className="space-y-3">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Admin</p>
        <h1 className="font-mono text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
          Painel de ingestao de questoes
        </h1>
        <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
          Esta area vai centralizar upload de PDF, OCR, transformacao via IA e revisao antes de salvar no banco.
        </p>
      </PixelCard>

      {loading && (
        <PixelCard>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Validando acesso admin...
          </p>
        </PixelCard>
      )}

      {!loading && error && (
        <PixelCard className="space-y-3 border-[var(--pixel-danger)] bg-[var(--pixel-danger)]/10">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-danger)]">Acesso negado</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{error}</p>
          <div>
            <Link href="/">
              <PixelButton>Voltar para home</PixelButton>
            </Link>
          </div>
        </PixelCard>
      )}

      {!loading && !error && status && (
        <PixelCard className="space-y-3">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Acesso autorizado</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Sessao validada para {status.admin.email}. Proximos passos: upload de PDF, pipeline OCR e revisao.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/upload">
              <PixelButton>Upload de PDF</PixelButton>
            </Link>
            <Link href="/admin/users">
              <PixelButton variant="ghost">Listar usuarios</PixelButton>
            </Link>
            <Link href="/admin/questions">
              <PixelButton variant="ghost">Banco de questoes</PixelButton>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Periodo:</span>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs"
            >
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </div>
        </PixelCard>
      )}

      {!loading && !error && metrics && (
        <>
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

            <div className="space-y-3 rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Resumo operacional</p>
              <p className="text-sm text-[var(--pixel-text)]">
                Periodo analisado: {days} dias. Acompanhe gargalos por servico e ajuste ingestao para cobrir lacunas de
                certificacao.
              </p>
              <p className="text-xs text-[var(--pixel-subtext)]">
                Dica: combine os novos filtros de usuarios/questoes para investigar impacto dos uploads no desempenho.
              </p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
