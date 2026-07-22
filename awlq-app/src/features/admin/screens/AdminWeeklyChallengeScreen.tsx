"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";

type ChallengeListItem = {
  id: string;
  weekStart: string;
  weekEnd: string;
  active: boolean;
  badgeImageUrl: string | null;
  entryCount: number;
  topEntries: { userId: string; name: string; score: number; rank: number | null }[];
};

type ChallengeEntry = {
  userId: string;
  name: string;
  email: string;
  score: number;
  rank: number | null;
  gainedXp: number;
  submittedAt: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AdminWeeklyChallengeScreen() {
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<"open" | "close" | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const loadChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/weekly-challenge", { credentials: "include" });
      const data = (await res.json()) as { challenges?: ChallengeListItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar desafios semanais");
      setChallenges(data.challenges ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar desafios semanais.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  async function handleToggleActive(challenge: ChallengeListItem) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/weekly-challenge/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !challenge.active }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao atualizar status");
      void loadChallenges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status.");
    }
  }

  async function handleTrigger(mode: "open" | "close") {
    setTriggering(mode);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/weekly-challenge/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao disparar acao");
      setMessage(
        mode === "open"
          ? "Abertura enfileirada — o worker processa em instantes."
          : "Fechamento/ranqueamento enfileirado — o worker processa em instantes.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao disparar acao.");
    } finally {
      setTriggering(null);
    }
  }

  async function toggleExpand(challengeId: string) {
    if (expandedId === challengeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(challengeId);
    setEntriesLoading(true);
    try {
      const res = await fetch(`/api/admin/weekly-challenge/${challengeId}`, { credentials: "include" });
      const data = (await res.json()) as { entries?: ChallengeEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar participantes");
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar participantes.");
    } finally {
      setEntriesLoading(false);
    }
  }

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Arena</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Desafio Semanal</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleTrigger("open")}
            disabled={triggering !== null}
            className="border border-[#22c55e] px-3 py-1.5 font-mono text-xs uppercase text-[#22c55e] hover:bg-[#22c55e]/10 disabled:opacity-50"
          >
            {triggering === "open" ? "Abrindo..." : "Forcar Abertura"}
          </button>
          <button
            type="button"
            onClick={() => void handleTrigger("close")}
            disabled={triggering !== null}
            className="border border-[#f97316] px-3 py-1.5 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-50"
          >
            {triggering === "close" ? "Fechando..." : "Forcar Fechamento + Ranking"}
          </button>
          <button
            type="button"
            onClick={() => void loadChallenges()}
            disabled={loading}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0] disabled:opacity-50"
          >
            Atualizar
          </button>
          {challenges.length > 0 && (
            <span className="font-mono text-xs text-[#64748b]">{challenges.length} desafio(s)</span>
          )}
        </div>
        <p className="font-mono text-[10px] text-[#64748b]">
          Abertura/fechamento tambem rodam automaticamente por cron (segunda 00:00 UTC / domingo 23:55 UTC). Use os
          botoes acima so para rodar fora do horario, ex. corrigir um desafio mal configurado.
        </p>
      </header>

      {message && <p className="font-mono text-xs text-[#86efac]">{message}</p>}
      {error && <p className="font-mono text-xs text-[#fca5a5]">{error}</p>}

      {loading ? (
        <p className="font-mono text-xs text-[#94a3b8]">Carregando desafios...</p>
      ) : (
        <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
              <tr>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Semana</th>
                <th className="px-3 py-2 text-center">Participantes</th>
                <th className="px-3 py-2">Lider</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((challenge) => (
                <Fragment key={challenge.id}>
                  <tr
                    key={challenge.id}
                    className="cursor-pointer border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]"
                    onClick={() => void toggleExpand(challenge.id)}
                  >
                    <td className="px-3 py-2 text-[#64748b]">
                      {expandedId === challenge.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(challenge.weekStart)} — {formatDate(challenge.weekEnd)}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{challenge.entryCount}</td>
                    <td className="px-3 py-2 text-xs text-[#94a3b8]">
                      {challenge.topEntries[0] ? `${challenge.topEntries[0].name} (${challenge.topEntries[0].score} pts)` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleActive(challenge);
                        }}
                        className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase ${
                          challenge.active
                            ? "border-[#14532d] bg-green-900/20 text-green-300"
                            : "border-[#334155] text-[#64748b]"
                        }`}
                      >
                        {challenge.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                        {challenge.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === challenge.id && (
                    <tr key={`${challenge.id}-detail`} className="border-b border-[#1e293b] bg-[#0b1120]">
                      <td colSpan={5} className="px-6 py-3">
                        {entriesLoading ? (
                          <p className="font-mono text-xs text-[#94a3b8]">Carregando participantes...</p>
                        ) : entries.length === 0 ? (
                          <p className="font-mono text-xs text-[#64748b]">Nenhuma submissao ainda.</p>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="text-[#64748b] uppercase">
                              <tr>
                                <th className="py-1 pr-4">#</th>
                                <th className="py-1 pr-4">Usuario</th>
                                <th className="py-1 pr-4">Pontos</th>
                                <th className="py-1 pr-4">XP ganho</th>
                                <th className="py-1 pr-4">Enviado em</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map((entry, idx) => (
                                <tr key={entry.userId} className="text-[#cbd5e1]">
                                  <td className="py-1 pr-4">{entry.rank ?? idx + 1}</td>
                                  <td className="py-1 pr-4">
                                    {entry.name} <span className="text-[#64748b]">({entry.email})</span>
                                  </td>
                                  <td className="py-1 pr-4 font-bold text-[#38bdf8]">{entry.score}</td>
                                  <td className="py-1 pr-4">{entry.gainedXp}</td>
                                  <td className="py-1 pr-4 text-[#64748b]">{formatDate(entry.submittedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {challenges.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                    Nenhum desafio semanal criado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
