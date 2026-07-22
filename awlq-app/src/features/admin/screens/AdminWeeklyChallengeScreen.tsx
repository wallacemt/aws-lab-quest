"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";

interface TopEntry {
  userId: string;
  name: string;
  score: number;
  rank: number | null;
}

interface ChallengeListItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  active: boolean;
  badgeImageUrl: string | null;
  entryCount: number;
  topEntries: TopEntry[];
}

interface FullEntry {
  userId: string;
  name: string;
  email: string;
  score: number;
  rank: number | null;
  gainedXp: number;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function AdminWeeklyChallengeScreen() {
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entriesByChallenge, setEntriesByChallenge] = useState<Record<string, FullEntry[]>>({});
  const [triggering, setTriggering] = useState(false);

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

  async function toggleExpand(challengeId: string) {
    if (expandedId === challengeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(challengeId);
    if (entriesByChallenge[challengeId]) return;
    try {
      const res = await fetch(`/api/admin/weekly-challenge/${challengeId}`, { credentials: "include" });
      const data = (await res.json()) as { challenge?: { entries: FullEntry[] }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar participantes");
      setEntriesByChallenge((prev) => ({ ...prev, [challengeId]: data.challenge?.entries ?? [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar participantes.");
    }
  }

  async function handleToggleActive(challenge: ChallengeListItem) {
    try {
      const res = await fetch(`/api/admin/weekly-challenge/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !challenge.active }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao atualizar status");
      setMessage(challenge.active ? "Desafio desativado." : "Desafio ativado.");
      void loadChallenges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status.");
    }
  }

  async function handleTrigger(mode: "open" | "close") {
    setTriggering(true);
    setError(null);
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
          ? "Abertura forcada enviada ao worker."
          : "Fechamento + calculo de ranking forcados enviados ao worker."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao disparar acao.");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Gamificacao</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Desafio Semanal</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleTrigger("open")}
            disabled={triggering}
            className="border border-[#f97316] px-3 py-1.5 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-50"
          >
            Forcar Abertura
          </button>
          <button
            type="button"
            onClick={() => void handleTrigger("close")}
            disabled={triggering}
            className="border border-[#f97316] px-3 py-1.5 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-50"
          >
            Forcar Fechamento + Ranking
          </button>
          <button
            type="button"
            onClick={() => void loadChallenges()}
            disabled={loading}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0] disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>
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
                <th className="px-3 py-2">Top 3</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((challenge) => (
                <Fragment key={challenge.id}>
                  <tr className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void toggleExpand(challenge.id)}
                        className="text-[#64748b] hover:text-[#e2e8f0]"
                        aria-label="Expandir participantes"
                      >
                        {expandedId === challenge.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(challenge.weekStart)} - {formatDate(challenge.weekEnd)}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{challenge.entryCount}</td>
                    <td className="px-3 py-2 text-xs text-[#94a3b8]">
                      {challenge.topEntries.length > 0
                        ? challenge.topEntries.map((e) => `${e.name} (${e.score})`).join(", ")
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(challenge)}
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
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void toggleExpand(challenge.id)}
                        className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                      >
                        Ver progresso
                      </button>
                    </td>
                  </tr>
                  {expandedId === challenge.id && (
                    <tr className="border-b border-[#1e293b] bg-[#0f172a]/60">
                      <td colSpan={6} className="px-3 py-3">
                        {entriesByChallenge[challenge.id] ? (
                          entriesByChallenge[challenge.id].length > 0 ? (
                            <table className="w-full text-left text-xs">
                              <thead className="text-[#64748b] uppercase">
                                <tr>
                                  <th className="px-2 py-1">Usuario</th>
                                  <th className="px-2 py-1">Email</th>
                                  <th className="px-2 py-1 text-center">Pontuacao</th>
                                  <th className="px-2 py-1 text-center">Rank</th>
                                  <th className="px-2 py-1 text-center">XP Ganho</th>
                                  <th className="px-2 py-1">Enviado em</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entriesByChallenge[challenge.id].map((entry) => (
                                  <tr key={entry.userId} className="border-t border-[#1e293b] text-[#cbd5e1]">
                                    <td className="px-2 py-1">{entry.name}</td>
                                    <td className="px-2 py-1 text-[#94a3b8]">{entry.email}</td>
                                    <td className="px-2 py-1 text-center font-mono">{entry.score}</td>
                                    <td className="px-2 py-1 text-center font-mono">{entry.rank ?? "-"}</td>
                                    <td className="px-2 py-1 text-center font-mono">{entry.gainedXp}</td>
                                    <td className="px-2 py-1">{formatDate(entry.createdAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-xs text-[#64748b]">Nenhum participante ainda.</p>
                          )
                        ) : (
                          <p className="text-xs text-[#64748b]">Carregando participantes...</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {challenges.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                    Nenhum desafio semanal cadastrado.
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
