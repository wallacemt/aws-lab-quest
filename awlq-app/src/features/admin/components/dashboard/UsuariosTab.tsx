"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getAdminMetricsUsers } from "@/features/admin/services/admin-api";
import { AdminMetricsUsers } from "@/features/admin/types";

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
                  <div className="h-full bg-[#38bdf8]" style={{ width: `${widthPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function UsuariosTab({ days, refreshKey }: Props) {
  const [data, setData] = useState<AdminMetricsUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getAdminMetricsUsers(days);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar dados de usuarios.");
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

  const avgMinutes = Math.round(data.avgSessionDurationSeconds / 60);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Usuarios aprovados" value={String(data.totalApproved)} />
        <StatCard title={`Novos (${days}d)`} value={String(data.newInPeriod)} />
        <StatCard title="Em risco (+7d sem acesso)" value={String(data.atRiskCount)} />
        <StatCard title="Duracao media (min)" value={String(avgMinutes)} />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {/* Line chart: novos usuarios por dia */}
        <div className="border border-[#1e293b] bg-[#111827] p-4">
          <p className="mb-4 font-mono text-[10px] uppercase text-[#94a3b8]">Novos usuarios por dia</p>
          {data.newUsersOverTime.length === 0 ? (
            <p className="text-xs text-[#64748b]">Sem dados no periodo.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.newUsersOverTime} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#1e293b" }}
                  tickLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
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
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Novos usuarios"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <BarList
          title="Breakdown por status de acesso"
          items={data.accessStatusBreakdown.map((item) => ({
            label: item.status,
            count: item.count,
          }))}
        />
      </section>

      {/* Top performers */}
      <div className="border border-[#1e293b] bg-[#111827]">
        <div className="border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
          <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Top 5 performers</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1e293b] text-[#64748b]">
                <th className="px-4 py-2 font-mono uppercase">Nome</th>
                <th className="px-4 py-2 font-mono uppercase">XP Total</th>
                <th className="px-4 py-2 font-mono uppercase">Sessoes</th>
              </tr>
            </thead>
            <tbody>
              {data.topPerformers.map((u) => (
                <tr key={u.userId} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2 font-mono text-[#f97316]">{u.totalXp}</td>
                  <td className="px-4 py-2 font-mono text-[#94a3b8]">{u.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usuarios em risco */}
      {data.atRisk.length > 0 && (
        <div className="border border-[#1e293b] bg-[#111827]">
          <div className="border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Usuarios em risco de churn</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1e293b] text-[#64748b]">
                  <th className="px-4 py-2 font-mono uppercase">Nome</th>
                  <th className="px-4 py-2 font-mono uppercase">Email</th>
                  <th className="px-4 py-2 font-mono uppercase">Ultima visita</th>
                  <th className="px-4 py-2 font-mono uppercase">Dias silencioso</th>
                </tr>
              </thead>
              <tbody>
                {data.atRisk.map((u) => (
                  <tr key={u.userId} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                    <td className="px-4 py-2">{u.name}</td>
                    <td className="px-4 py-2 font-mono text-[#94a3b8]">{u.email}</td>
                    <td className="px-4 py-2 font-mono text-[#94a3b8]">{u.lastSeen.slice(0, 10)}</td>
                    <td className="px-4 py-2 font-mono text-[#fca5a5]">{u.daysSilent}d</td>
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
