"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { getAdminMetricsQuestions } from "@/features/admin/services/admin-api";
import { AdminMetricsQuestions } from "@/features/admin/types";

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

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#f97316",
  nightmare: "#a855f7",
};

export function QuestoesTab({ days, refreshKey }: Props) {
  const [data, setData] = useState<AdminMetricsQuestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getAdminMetricsQuestions(days);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar dados de questoes.");
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

  const difficultyChartData = data.byDifficulty.map((item) => ({
    name: item.difficulty,
    count: item.count,
    fill: DIFFICULTY_COLORS[item.difficulty] ?? "#94a3b8",
  }));

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard title="Total de questoes" value={String(data.total)} />
        <StatCard
          title="Flagged para review"
          value={`${data.flaggedPercent}%`}
          subtitle={`${data.flaggedCount} questoes`}
        />
        <StatCard title={`Adicionadas (${days}d)`} value={String(data.addedInPeriod)} />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {/* Bar chart por dificuldade */}
        <div className="border border-[#1e293b] bg-[#111827] p-4">
          <p className="mb-4 font-mono text-[10px] uppercase text-[#94a3b8]">Questoes por dificuldade</p>
          {difficultyChartData.length === 0 ? (
            <p className="text-xs text-[#64748b]">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={difficultyChartData} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#1e293b" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#1e293b" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 0 }}
                  labelStyle={{ color: "#e2e8f0", fontFamily: "monospace", fontSize: 11 }}
                  itemStyle={{ color: "#cbd5e1", fontSize: 11 }}
                />
                <Bar dataKey="count" name="Questoes" radius={0}>
                  {difficultyChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <BarList
          title="Top 8 certificacoes"
          items={data.byCertification.slice(0, 8).map((item) => ({
            label: `${item.code} — ${item.name}`,
            count: item.count,
          }))}
        />
      </section>

      {/* Ultimas 10 questoes */}
      <div className="border border-[#1e293b] bg-[#111827]">
        <div className="border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
          <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Ultimas questoes adicionadas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1e293b] text-[#64748b]">
                <th className="px-4 py-2 font-mono uppercase">Enunciado</th>
                <th className="px-4 py-2 font-mono uppercase">Cert</th>
                <th className="px-4 py-2 font-mono uppercase">Dificuldade</th>
                <th className="px-4 py-2 font-mono uppercase">Data</th>
              </tr>
            </thead>
            <tbody>
              {data.recentlyAdded.map((q) => (
                <tr key={q.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                  <td className="max-w-[280px] truncate px-4 py-2">{q.statement}</td>
                  <td className="px-4 py-2 font-mono text-[#94a3b8]">{q.certCode ?? "—"}</td>
                  <td className="px-4 py-2 font-mono" style={{ color: DIFFICULTY_COLORS[q.difficulty] ?? "#94a3b8" }}>
                    {q.difficulty}
                  </td>
                  <td className="px-4 py-2 font-mono text-[#94a3b8]">{q.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
