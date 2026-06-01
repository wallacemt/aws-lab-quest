"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getAdminMetricsEngagement } from "@/features/admin/services/admin-api";
import { AdminMetricsEngagement } from "@/features/admin/types";

type Props = { days: number; refreshKey: number };

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="border border-[#1e293b] bg-[#111827] p-3">
      <p className="font-mono text-[10px] uppercase text-[#64748b]">{title}</p>
      <p className="mt-2 font-mono text-lg uppercase text-[#f97316]">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-[#94a3b8]">{subtitle}</p>}
    </div>
  );
}

function BarList({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  const maxValue = items.reduce((acc, item) => Math.max(acc, item.count), 0);

  return (
    <div className="space-y-3 border border-[#1e293b] bg-[#111827] p-3">
      <p className="font-mono text-[10px] uppercase text-[#94a3b8]">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-[#64748b]">Sem dados no periodo.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const widthPercent = maxValue > 0 ? Math.max(3, Math.round((item.count / maxValue) * 100)) : 0;
            return (
              <div key={`${title}-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-[#e2e8f0]">{item.label}</span>
                  <span className="font-mono text-[#94a3b8]">{item.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded border border-[#1e293b] bg-[#0b1220]">
                  <div className="h-full bg-[#f97316]" style={{ width: `${widthPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 0 },
  labelStyle: { color: "#e2e8f0", fontFamily: "monospace", fontSize: 11 },
  itemStyle: { color: "#cbd5e1", fontSize: 11 },
};

const AXIS_TICK = { fill: "#64748b", fontSize: 11, fontFamily: "monospace" };

export function EngajamentoTab({ days, refreshKey }: Props) {
  const [data, setData] = useState<AdminMetricsEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getAdminMetricsEngagement(days);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar dados de engajamento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [days, refreshKey]);

  if (loading) return <p className="font-mono text-xs uppercase text-[#94a3b8]">Carregando...</p>;
  if (error) return <p className="text-sm text-[#fca5a5]">{error}</p>;
  if (!data) return null;

  const avgMinutes = Math.round(data.avgDurationSeconds / 60);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Sessoes KC" value={String(data.kcSessions)} />
        <StatCard title="Sessoes Simulado" value={String(data.simuladoSessions)} />
        <StatCard title="XP medio / sessao" value={String(Math.round(data.avgXpPerSession))} />
        <StatCard title="Tempo medio (min)" value={String(avgMinutes)} />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {/* Sessoes por tipo por dia (empilhado) */}
        <div className="border border-[#1e293b] bg-[#111827] p-4">
          <p className="mb-4 font-mono text-[10px] uppercase text-[#94a3b8]">Sessoes por tipo por dia</p>
          {data.sessionsByTypeOverTime.length === 0 ? (
            <p className="text-xs text-[#64748b]">Sem dados no periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.sessionsByTypeOverTime}
                margin={{ top: 4, right: 16, left: -10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={AXIS_TICK}
                  axisLine={{ stroke: "#1e293b" }}
                  tickLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", paddingTop: 8 }} />
                <Bar dataKey="kc" name="KC" stackId="a" fill="#f97316" radius={0} />
                <Bar dataKey="simulado" name="Simulado" stackId="a" fill="#38bdf8" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Horas mais ativas */}
        <div className="border border-[#1e293b] bg-[#111827] p-4">
          <p className="mb-4 font-mono text-[10px] uppercase text-[#94a3b8]">Horas mais ativas</p>
          {data.mostActiveHours.length === 0 ? (
            <p className="text-xs text-[#64748b]">Sem dados no periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.mostActiveHours}
                margin={{ top: 4, right: 16, left: -10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="hour"
                  tick={AXIS_TICK}
                  axisLine={{ stroke: "#1e293b" }}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}h`}
                />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Sessoes" fill="#a78bfa" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <BarList
        title="Histograma de XP ganho por sessao"
        items={data.xpHistogram.map((item) => ({ label: item.bucket, count: item.count }))}
      />
    </div>
  );
}
