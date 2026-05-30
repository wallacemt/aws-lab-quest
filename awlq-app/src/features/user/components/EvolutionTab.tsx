"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PixelCard } from "@/components/ui/pixel-card";

type StudyHistoryItem = {
  id: string;
  sessionType: "KC" | "SIMULADO";
  scorePercent: number;
  packId: string | null;
  packName: string | null;
  completedAt: string;
};

type PackGroup = {
  packId: string | null;
  packName: string;
  attempts: number;
  bestScore: number;
  lastSession: string;
};

function getTrendLabel(sessions: StudyHistoryItem[]): string {
  if (sessions.length < 3) return "→ Estável";
  const first5 = sessions.slice(0, Math.min(5, Math.floor(sessions.length / 2)));
  const last5 = sessions.slice(-Math.min(5, Math.floor(sessions.length / 2)));
  const avgFirst = first5.reduce((sum, s) => sum + s.scorePercent, 0) / first5.length;
  const avgLast = last5.reduce((sum, s) => sum + s.scorePercent, 0) / last5.length;
  const delta = avgLast - avgFirst;
  if (delta > 4) return "↑ Melhorando";
  if (delta < -4) return "↓ Caindo";
  return "→ Estável";
}

function formatShortDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function EvolutionTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudyHistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/study/history", { credentials: "include" });
        if (!res.ok) throw new Error("Falha ao carregar historico.");
        const data = (await res.json()) as { history?: StudyHistoryItem[] };
        if (!cancelled) {
          const simulados = (data.history ?? [])
            .filter((s) => s.sessionType === "SIMULADO" && s.scorePercent != null)
            .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
          setSessions(simulados);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro desconhecido.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const avgScore = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.round(sessions.reduce((sum, s) => sum + s.scorePercent, 0) / sessions.length);
  }, [sessions]);

  const bestScore = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.max(...sessions.map((s) => s.scorePercent));
  }, [sessions]);

  const trend = useMemo(() => getTrendLabel(sessions), [sessions]);

  const chartData = useMemo(
    () =>
      sessions.map((s, i) => ({
        label: formatShortDate(s.completedAt),
        score: s.scorePercent,
        index: i + 1,
      })),
    [sessions],
  );

  const packGroups = useMemo<PackGroup[]>(() => {
    const map = new Map<string, PackGroup>();
    for (const s of sessions) {
      const key = s.packId ?? "__no_pack__";
      const existing = map.get(key);
      if (existing) {
        existing.attempts += 1;
        existing.bestScore = Math.max(existing.bestScore, s.scorePercent);
        if (new Date(s.completedAt) > new Date(existing.lastSession)) {
          existing.lastSession = s.completedAt;
        }
      } else {
        map.set(key, {
          packId: s.packId,
          packName: s.packName ?? "Pack sem nome",
          attempts: 1,
          bestScore: s.scorePercent,
          lastSession: s.completedAt,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.bestScore - a.bestScore);
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando historico...</p>
      </div>
    );
  }

  if (error) {
    return <p className="font-mono text-xs text-red-400">{error}</p>;
  }

  if (sessions.length === 0) {
    return (
      <PixelCard>
        <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
          Nenhum simulado concluido ainda. Complete um simulado para ver sua evolucao aqui.
        </p>
      </PixelCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PixelCard className="flex flex-col items-center gap-1 text-center">
          <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Media</p>
          <p className="font-mono text-2xl font-bold text-[var(--pixel-primary)]">{avgScore}%</p>
        </PixelCard>
        <PixelCard className="flex flex-col items-center gap-1 text-center">
          <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Melhor</p>
          <p className="font-mono text-2xl font-bold text-[var(--pixel-primary)]">{bestScore}%</p>
        </PixelCard>
        <PixelCard className="flex flex-col items-center gap-1 text-center">
          <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Simulados</p>
          <p className="font-mono text-2xl font-bold text-[var(--pixel-primary)]">{sessions.length}</p>
        </PixelCard>
        <PixelCard className="flex flex-col items-center gap-1 text-center">
          <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Tendencia</p>
          <p className={`font-mono text-sm font-bold ${trend.startsWith("↑") ? "text-green-400" : trend.startsWith("↓") ? "text-red-400" : "text-[var(--pixel-subtext)]"}`}>
            {trend}
          </p>
        </PixelCard>
      </div>

      {/* Score timeline chart */}
      <PixelCard>
        <p className="mb-4 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Evolucao de pontuacao</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--pixel-primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--pixel-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--pixel-border)" strokeOpacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fontFamily: "var(--font-pixel, monospace)", fontSize: 8, fill: "var(--pixel-subtext)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontFamily: "var(--font-pixel, monospace)", fontSize: 8, fill: "var(--pixel-subtext)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--pixel-card)",
                border: "1px solid var(--pixel-border)",
                borderRadius: 0,
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--pixel-text)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [`${Number(value) ?? 0}%`, "Score"]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--pixel-primary)"
              strokeWidth={2}
              fill="url(#scoreGradient)"
              dot={{ fill: "var(--pixel-primary)", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "var(--pixel-primary)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </PixelCard>

      {/* Per-pack table */}
      {packGroups.length > 0 && (
        <PixelCard>
          <p className="mb-3 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Por pack</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--pixel-border)]">
                  <th className="pb-2 text-left font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Pack</th>
                  <th className="pb-2 text-center font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Tentativas</th>
                  <th className="pb-2 text-center font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Melhor</th>
                  <th className="pb-2 text-right font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Ultima Sessao</th>
                </tr>
              </thead>
              <tbody>
                {packGroups.map((group) => (
                  <tr key={group.packId ?? group.packName} className="border-b border-[var(--pixel-border)]/30">
                    <td className="py-2 pr-3 font-mono text-xs text-[var(--pixel-text)]">{group.packName}</td>
                    <td className="py-2 text-center font-mono text-xs text-[var(--pixel-subtext)]">{group.attempts}</td>
                    <td className="py-2 text-center font-mono text-xs font-bold text-[var(--pixel-primary)]">
                      {group.bestScore}%
                    </td>
                    <td className="py-2 text-right font-mono text-[9px] text-[var(--pixel-subtext)]">
                      {format(parseISO(group.lastSession), "dd/MM/yy", { locale: ptBR })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PixelCard>
      )}
    </div>
  );
}
