"use client";

import { useEffect, useState } from "react";

type Props = { days: number; refreshKey: number };

type WorkerQueueStats = {
  queue: string;
  pending: number;
  active: number;
  completed: number;
  failed: number;
};

type RecentTrigger = {
  id: string;
  action: string;
  source: string;
  processedAt: string | null;
  createdAt: string;
};

type ScheduledJob = {
  id: string;
  jobId: string;
  name: string;
  queue: string;
  cronPattern: string;
  active: boolean;
  updatedAt: string;
};

type WorkerData = {
  queues?: WorkerQueueStats[];
  triggerHistory?: RecentTrigger[];
  scheduledJobs?: ScheduledJob[];
  // The existing /api/admin/worker returns a rich payload — we pick what we need
  [key: string]: unknown;
};

export function SistemaTab({ refreshKey }: Props) {
  const [data, setData] = useState<WorkerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/worker", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("Falha ao carregar dados do worker.");
        const json = (await res.json()) as WorkerData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar sistema.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) return <p className="font-mono text-xs uppercase text-[#94a3b8]">Carregando...</p>;
  if (error) return <p className="text-sm text-[#fca5a5]">{error}</p>;
  if (!data) return null;

  const queues = data.queues ?? [];
  const triggers = (data.triggerHistory ?? []) as RecentTrigger[];
  const scheduledJobs = (data.scheduledJobs ?? []) as ScheduledJob[];

  return (
    <div className="space-y-4">
      {/* Queue stats */}
      {queues.length > 0 && (
        <div className="border border-[#1e293b] bg-[#111827]">
          <div className="border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Status das filas</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1e293b] text-[#64748b]">
                  <th className="px-4 py-2 font-mono uppercase">Fila</th>
                  <th className="px-4 py-2 font-mono uppercase">Pendente</th>
                  <th className="px-4 py-2 font-mono uppercase">Ativo</th>
                  <th className="px-4 py-2 font-mono uppercase">Concluido</th>
                  <th className="px-4 py-2 font-mono uppercase">Falhas</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.queue} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                    <td className="px-4 py-2 font-mono">{q.queue}</td>
                    <td className="px-4 py-2 font-mono text-[#f59e0b]">{q.pending}</td>
                    <td className="px-4 py-2 font-mono text-[#38bdf8]">{q.active}</td>
                    <td className="px-4 py-2 font-mono text-[#86efac]">{q.completed}</td>
                    <td className="px-4 py-2 font-mono text-[#fca5a5]">{q.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheduled jobs */}
      {scheduledJobs.length > 0 && (
        <div className="border border-[#1e293b] bg-[#111827]">
          <div className="border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Jobs agendados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1e293b] text-[#64748b]">
                  <th className="px-4 py-2 font-mono uppercase">Nome</th>
                  <th className="px-4 py-2 font-mono uppercase">Fila</th>
                  <th className="px-4 py-2 font-mono uppercase">Cron</th>
                  <th className="px-4 py-2 font-mono uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduledJobs.map((job) => (
                  <tr key={job.jobId} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                    <td className="px-4 py-2">{job.name}</td>
                    <td className="px-4 py-2 font-mono text-[#94a3b8]">{job.queue}</td>
                    <td className="px-4 py-2 font-mono text-[#94a3b8]">{job.cronPattern}</td>
                    <td className="px-4 py-2 font-mono">
                      <span className={job.active ? "text-[#86efac]" : "text-[#94a3b8]"}>
                        {job.active ? "ativo" : "inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ultimos 10 WorkerTriggers processados */}
      {triggers.length > 0 && (
        <div className="border border-[#1e293b] bg-[#111827]">
          <div className="border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Ultimos triggers processados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1e293b] text-[#64748b]">
                  <th className="px-4 py-2 font-mono uppercase">Acao</th>
                  <th className="px-4 py-2 font-mono uppercase">Origem</th>
                  <th className="px-4 py-2 font-mono uppercase">Criado em</th>
                  <th className="px-4 py-2 font-mono uppercase">Processado em</th>
                </tr>
              </thead>
              <tbody>
                {triggers.slice(0, 10).map((t) => (
                  <tr key={t.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                    <td className="px-4 py-2 font-mono">{t.action}</td>
                    <td className="px-4 py-2 font-mono text-[#94a3b8]">{t.source}</td>
                    <td className="px-4 py-2 font-mono text-[#94a3b8]">{t.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td className="px-4 py-2 font-mono text-[#94a3b8]">
                      {t.processedAt ? t.processedAt.slice(0, 16).replace("T", " ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {queues.length === 0 && scheduledJobs.length === 0 && triggers.length === 0 && (
        <p className="text-sm text-[#94a3b8]">Sem dados de sistema disponiveis. O worker pode estar desligado.</p>
      )}
    </div>
  );
}
