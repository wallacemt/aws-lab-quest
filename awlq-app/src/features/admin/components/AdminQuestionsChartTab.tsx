"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAdminQuestionsStats } from "@/features/admin/services/admin-api";
import type { AdminQuestionsStats } from "@/features/admin/types";

type Props = {
  from: Date;
  to: Date;
  certificationCode?: string;
};

const DIFF_COLORS = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#f97316",
  nightmare: "#a855f7",
};

function formatDayLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

export function AdminQuestionsChartTab({ from, to, certificationCode }: Props) {
  const [stats, setStats] = useState<AdminQuestionsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdminQuestionsStats({
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
          certificationCode: certificationCode || undefined,
        });
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar estatísticas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [from, to, certificationCode]);

  const chartData = stats?.days.map((d) => ({
    ...d,
    label: formatDayLabel(d.date),
  })) ?? [];

  const activeDays = stats?.days.filter((d) => d.total > 0).length ?? 0;
  const avgPerDay = activeDays > 0 ? Math.round((stats?.total ?? 0) / activeDays) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Carregando estatísticas...</p>
      </div>
    );
  }

  if (error) {
    return <p className="py-4 text-xs text-[#fca5a5]">{error}</p>;
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="border border-[#1e293b] bg-[#111827] p-4">
          <p className="font-mono text-[10px] uppercase text-[#64748b]">Total no período</p>
          <p className="mt-1 font-mono text-2xl text-[#f8fafc]">{stats.total}</p>
        </div>
        <div className="border border-[#1e293b] bg-[#111827] p-4">
          <p className="font-mono text-[10px] uppercase text-[#64748b]">Pico diário</p>
          <p className="mt-1 font-mono text-2xl text-[#f97316]">{stats.peak}</p>
        </div>
        <div className="border border-[#1e293b] bg-[#111827] p-4">
          <p className="font-mono text-[10px] uppercase text-[#64748b]">Dias com geração</p>
          <p className="mt-1 font-mono text-2xl text-[#38bdf8]">{activeDays}</p>
        </div>
        <div className="border border-[#1e293b] bg-[#111827] p-4">
          <p className="font-mono text-[10px] uppercase text-[#64748b]">Média (dias ativos)</p>
          <p className="mt-1 font-mono text-2xl text-[#a78bfa]">{avgPerDay}</p>
        </div>
      </div>

      {/* Bar chart — total por dia */}
      <div className="border border-[#1e293b] bg-[#111827] p-4">
        <p className="mb-4 font-mono text-xs uppercase text-[#94a3b8]">Questões geradas por dia</p>
        {stats.total === 0 ? (
          <p className="py-8 text-center text-sm text-[#475569]">Nenhuma questão encontrada no período selecionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
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
                formatter={(value, name) => [value as number, name as string]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", paddingTop: 12 }}
              />
              <Bar dataKey="easy" name="easy" stackId="a" fill={DIFF_COLORS.easy} radius={0} />
              <Bar dataKey="medium" name="medium" stackId="a" fill={DIFF_COLORS.medium} radius={0} />
              <Bar dataKey="hard" name="hard" stackId="a" fill={DIFF_COLORS.hard} radius={0} />
              <Bar dataKey="nightmare" name="nightmare" stackId="a" fill={DIFF_COLORS.nightmare} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabela de dias */}
      {stats.total > 0 && (
        <div className="border border-[#1e293b] bg-[#111827]">
          <div className="border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Detalhamento por dia</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1e293b] text-[#64748b]">
                  <th className="px-4 py-2 font-mono uppercase">Data</th>
                  <th className="px-4 py-2 font-mono uppercase">Total</th>
                  <th className="px-4 py-2 font-mono uppercase text-[#22c55e]">Easy</th>
                  <th className="px-4 py-2 font-mono uppercase text-[#f59e0b]">Medium</th>
                  <th className="px-4 py-2 font-mono uppercase text-[#f97316]">Hard</th>
                  <th className="px-4 py-2 font-mono uppercase text-[#a855f7]">Nightmare</th>
                </tr>
              </thead>
              <tbody>
                {stats.days
                  .filter((d) => d.total > 0)
                  .map((d) => (
                    <tr key={d.date} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                      <td className="px-4 py-2 font-mono">{formatDayLabel(d.date)}</td>
                      <td className="px-4 py-2 font-mono font-semibold">{d.total}</td>
                      <td className="px-4 py-2 font-mono text-[#22c55e]">{d.easy || "-"}</td>
                      <td className="px-4 py-2 font-mono text-[#f59e0b]">{d.medium || "-"}</td>
                      <td className="px-4 py-2 font-mono text-[#f97316]">{d.hard || "-"}</td>
                      <td className="px-4 py-2 font-mono text-[#a855f7]">{d.nightmare || "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
