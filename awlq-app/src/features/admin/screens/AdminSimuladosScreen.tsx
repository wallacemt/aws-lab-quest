"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CertificationOption } from "@/features/admin/types";

type SimuladoPackItem = {
  id: string;
  name: string;
  certificationCode: string | null;
  certificationName: string | null;
  questionCount: number;
  active: boolean;
  createdAt: string;
  createdByName: string | null;
  sessionCount: number;
};

type PacksPayload = {
  items: SimuladoPackItem[];
  total: number;
  page: number;
  pageSize: number;
};

type GenerateStats = {
  available: number;
  packsPossible: number;
  packSize: number;
} | null;

export function AdminSimuladosScreen() {
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [filterCert, setFilterCert] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PacksPayload | null>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateCert, setGenerateCert] = useState("");
  const [generateStats, setGenerateStats] = useState<GenerateStats>(null);
  const [generateStatsLoading, setGenerateStatsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadCerts() {
      try {
        const res = await fetch("/api/certifications", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { certifications?: CertificationOption[] };
        setCertifications(json.certifications ?? []);
      } catch {
        // non-fatal
      }
    }
    void loadCerts();
  }, []);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (filterCert) params.set("certificationCode", filterCert);
      if (filterActive) params.set("active", filterActive);
      const res = await fetch(`/api/admin/simulado-packs?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar packs");
      const json = (await res.json()) as PacksPayload;
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [page, filterCert, filterActive]);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  async function loadGenerateStats(code: string) {
    if (!code) {
      setGenerateStats(null);
      return;
    }
    setGenerateStatsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/simulado-packs/generate?certificationCode=${encodeURIComponent(code)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error();
      const json = (await res.json()) as GenerateStats;
      setGenerateStats(json);
    } catch {
      setGenerateStats(null);
    } finally {
      setGenerateStatsLoading(false);
    }
  }

  function handleOpenGenerate() {
    setGenerateCert("");
    setGenerateStats(null);
    setGenerateError(null);
    setShowGenerateModal(true);
  }

  async function handleGenerate() {
    if (!generateCert) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/admin/simulado-packs/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificationCode: generateCert }),
      });
      const json = (await res.json()) as { created?: number; packs?: { name: string }[]; error?: string };
      if (!res.ok) {
        setGenerateError(json.error ?? "Erro ao gerar packs");
        return;
      }
      setShowGenerateModal(false);
      setGlobalMessage(`${json.created ?? 0} pack(s) gerado(s) com sucesso!`);
      void loadPacks();
    } catch {
      setGenerateError("Erro de conexao ao gerar packs");
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleActive(pack: SimuladoPackItem) {
    try {
      const res = await fetch(`/api/admin/simulado-packs/${pack.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !pack.active }),
      });
      if (!res.ok) throw new Error();
      void loadPacks();
    } catch {
      setError("Falha ao atualizar pack");
    }
  }

  async function handleDelete(packId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/simulado-packs/${packId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as { deleted?: boolean; deactivated?: boolean };
      if (!res.ok) throw new Error();
      if (json.deactivated) {
        setGlobalMessage("Pack tinha sessoes associadas — desativado em vez de excluido.");
      } else {
        setGlobalMessage("Pack excluido.");
      }
      setConfirmDeleteId(null);
      void loadPacks();
    } catch {
      setError("Falha ao excluir pack");
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 1;

  return (
    <div className="space-y-6 p-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-sm uppercase text-[#f97316]">Simulados / Packs</h1>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Gerencie os packs de questoes para simulados.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/simulados/maker"
            className="border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316]"
          >
            Maker
          </Link>
          <button
            onClick={handleOpenGenerate}
            className="border border-[#f97316] px-4 py-2 text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10"
          >
            + Gerar Packs
          </button>
        </div>
      </div>

      {globalMessage && (
        <div className="border border-green-700 bg-green-900/20 px-4 py-3 text-xs text-green-300">
          {globalMessage}
          <button onClick={() => setGlobalMessage(null)} className="ml-4 underline">
            Fechar
          </button>
        </div>
      )}

      {error && (
        <div className="border border-red-700 bg-red-900/20 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterCert}
          onChange={(e) => { setFilterCert(e.target.value); setPage(1); }}
          className="border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-[#e2e8f0]"
        >
          <option value="">Todas certificacoes</option>
          {certifications.map((c) => (
            <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
          ))}
        </select>

        <select
          value={filterActive}
          onChange={(e) => { setFilterActive(e.target.value as "" | "true" | "false"); setPage(1); }}
          className="border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-[#e2e8f0]"
        >
          <option value="">Todos status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>

        <button
          onClick={() => { setFilterCert(""); setFilterActive(""); setPage(1); }}
          className="border border-[#334155] px-3 py-2 text-xs uppercase text-[#94a3b8] hover:border-[#475569]"
        >
          Limpar filtros
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1e293b]">
              <th className="px-3 py-2 text-left font-mono uppercase text-[#64748b]">Nome</th>
              <th className="px-3 py-2 text-left font-mono uppercase text-[#64748b]">Cert</th>
              <th className="px-3 py-2 text-center font-mono uppercase text-[#64748b]">Questoes</th>
              <th className="px-3 py-2 text-center font-mono uppercase text-[#64748b]">Sessoes</th>
              <th className="px-3 py-2 text-center font-mono uppercase text-[#64748b]">Status</th>
              <th className="px-3 py-2 text-left font-mono uppercase text-[#64748b]">Criado em</th>
              <th className="px-3 py-2 text-left font-mono uppercase text-[#64748b]">Criado por</th>
              <th className="px-3 py-2 text-center font-mono uppercase text-[#64748b]">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[#64748b]">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && result?.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[#64748b]">
                  Nenhum pack encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              result?.items.map((pack) => (
                <tr
                  key={pack.id}
                  className={`border-b border-[#1e293b] hover:bg-[#111827] ${!pack.active ? "opacity-50" : ""}`}
                >
                  <td className="px-3 py-2 font-mono text-[#e2e8f0]">{pack.name}</td>
                  <td className="px-3 py-2">
                    <span className="border border-[#334155] px-2 py-0.5 font-mono text-[10px] uppercase text-[#94a3b8]">
                      {pack.certificationCode ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[#cbd5e1]">{pack.questionCount}</td>
                  <td className="px-3 py-2 text-center text-[#94a3b8]">{pack.sessionCount}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                        pack.active
                          ? "border-green-700 text-green-400"
                          : "border-[#334155] text-[#64748b]"
                      }`}
                    >
                      {pack.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#64748b]">
                    {new Date(pack.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-[#64748b]">{pack.createdByName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => void handleToggleActive(pack)}
                        className="border border-[#334155] px-2 py-1 text-[10px] uppercase text-[#94a3b8] hover:border-[#475569]"
                      >
                        {pack.active ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(pack.id)}
                        className="border border-red-800/60 px-2 py-1 text-[10px] uppercase text-red-400 hover:border-red-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {result && result.total > result.pageSize && (
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border border-[#334155] px-3 py-1 uppercase disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-[#64748b]">
            Pagina {page} de {totalPages} ({result.total} packs)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border border-[#334155] px-3 py-1 uppercase disabled:opacity-30"
          >
            Proxima
          </button>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md border border-[#334155] bg-[#0f172a] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase text-[#f97316]">Gerar Packs de Simulado</h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-xs text-[#64748b] hover:text-[#cbd5e1]"
              >
                Fechar
              </button>
            </div>

            <p className="text-xs text-[#94a3b8]">
              Os packs sao gerados automaticamente com {65} questoes cada, distribuidas por dificuldade (30% facil, 50% medio, 20% dificil). Apenas questoes sem pack ativo sao utilizadas.
            </p>

            <div className="space-y-2">
              <label className="block font-mono text-[10px] uppercase text-[#64748b]">
                Certificacao
              </label>
              <select
                value={generateCert}
                onChange={(e) => {
                  setGenerateCert(e.target.value);
                  void loadGenerateStats(e.target.value);
                }}
                className="w-full border border-[#334155] bg-[#111827] px-3 py-2 text-xs text-[#e2e8f0]"
              >
                <option value="">Selecionar...</option>
                {certifications.map((c) => (
                  <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>

            {generateCert && (
              <div className="border border-[#1e293b] bg-[#111827] px-4 py-3 text-xs space-y-1">
                {generateStatsLoading ? (
                  <p className="text-[#64748b]">Calculando...</p>
                ) : generateStats ? (
                  <>
                    <p className="text-[#cbd5e1]">
                      Questoes disponiveis (sem pack ativo):{" "}
                      <span className="font-mono text-[#f97316]">{generateStats.available}</span>
                    </p>
                    <p className="text-[#cbd5e1]">
                      Packs que serao gerados:{" "}
                      <span className="font-mono text-[#f97316]">{generateStats.packsPossible}</span>
                    </p>
                    {generateStats.packsPossible === 0 && (
                      <p className="text-yellow-400">
                        Questoes insuficientes para gerar packs (minimo: {generateStats.packSize}).
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-red-400">Falha ao carregar estatisticas.</p>
                )}
              </div>
            )}

            {generateError && (
              <p className="text-xs text-red-400">{generateError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => void handleGenerate()}
                disabled={
                  generating ||
                  !generateCert ||
                  !generateStats ||
                  generateStats.packsPossible === 0
                }
                className="flex-1 border border-[#f97316] py-2 text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-40"
              >
                {generating ? "Gerando..." : "Gerar"}
              </button>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm border border-red-800 bg-[#0f172a] p-6 space-y-4">
            <h2 className="font-mono text-xs uppercase text-red-400">Confirmar exclusao</h2>
            <p className="text-xs text-[#cbd5e1]">
              Se este pack tiver sessoes associadas, sera desativado em vez de excluido.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => void handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="flex-1 border border-red-700 py-2 text-xs uppercase text-red-400 hover:bg-red-900/20 disabled:opacity-40"
              >
                {deleting ? "Excluindo..." : "Confirmar"}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
