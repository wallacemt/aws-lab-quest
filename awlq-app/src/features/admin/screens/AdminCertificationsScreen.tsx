"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdminCertification, listAdminCertifications } from "@/features/admin/services/admin-api";
import type { AdminCertificationListItem } from "@/features/admin/types";

export function AdminCertificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AdminCertificationListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newCert, setNewCert] = useState({ code: "", name: "", description: "", examMinutes: "90", passingScorePercent: "70", displayOrder: "" });

  const loadCertifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminCertifications();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar certificacoes.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newCert.code.trim() || !newCert.name.trim() || !newCert.description.trim()) {
      setCreateError("Preencha codigo, nome e descricao.");
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    setCreateMsg(null);
    try {
      await createAdminCertification({ code: newCert.code, name: newCert.name, description: newCert.description, examMinutes: Number(newCert.examMinutes), passingScorePercent: Number(newCert.passingScorePercent), ...(newCert.displayOrder.trim() ? { displayOrder: Number(newCert.displayOrder) } : {}) });
      setShowCreate(false);
      setNewCert({ code: "", name: "", description: "", examMinutes: "90", passingScorePercent: "70", displayOrder: "" });
      setCreateMsg("Certificacao criada com sucesso.");
      await loadCertifications();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar certificacao.");
    } finally {
      setCreateSaving(false);
    }
  }

  useEffect(() => {
    void loadCertifications();
  }, [loadCertifications]);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? items.filter((c) => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query))
    : items;

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Certificacoes</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gerenciamento de certificacoes</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadCertifications()}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0]"
          >
            Atualizar dados
          </button>
          <button type="button" onClick={() => { setShowCreate((value) => !value); setCreateError(null); }} className="border border-[#f97316] px-3 py-1 text-xs uppercase text-[#f97316]">Nova certificação</button>
          {createMsg && <p className="text-xs text-green-400">{createMsg}</p>}
        </div>
      </header>

      {showCreate && <form onSubmit={(event) => void handleCreate(event)} className="space-y-3 border border-[#1e293b] bg-[#111827] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {([ ["code", "Codigo"], ["name", "Nome"], ["description", "Descricao"], ["examMinutes", "Duracao da prova (min)"], ["passingScorePercent", "Nota de corte (% de acertos)"], ["displayOrder", "Ordem de exibicao (vazio = fim da lista)" ] ] as const).map(([key, label]) => <label key={key} className="block space-y-1"><span className="text-[10px] uppercase text-[#64748b]">{label}</span>{key === "description" ? <textarea required value={newCert[key]} onChange={(e) => setNewCert({ ...newCert, [key]: e.target.value })} maxLength={500} className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0]" /> : <input required={key === "code" || key === "name"} type={key === "examMinutes" || key === "passingScorePercent" || key === "displayOrder" ? "number" : "text"} min={key === "examMinutes" ? 1 : key === "passingScorePercent" ? 1 : undefined} max={key === "passingScorePercent" ? 100 : undefined} maxLength={key === "name" ? 120 : undefined} value={newCert[key]} onChange={(e) => setNewCert({ ...newCert, [key]: e.target.value })} className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0]" />}</label>)}
        </div>
        <div className="flex items-center gap-3"><button disabled={createSaving} className="border border-[#f97316] px-3 py-1.5 text-xs uppercase text-[#f97316] disabled:opacity-50">{createSaving ? "Criando..." : "Criar certificacao"}</button>{createError && <p className="text-xs text-[#fca5a5]">{createError}</p>}</div>
      </form>}

      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por codigo ou nome"
          className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none md:max-w-sm"
        />
      </section>

      {loading && <p className="text-sm text-[#94a3b8]">Carregando certificacoes...</p>}
      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

      {!loading && !error && (
        <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
              <tr>
                <th className="px-3 py-2">Codigo</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2 text-center">Ativa</th>
                <th className="px-3 py-2 text-center">Questoes</th>
                <th className="px-3 py-2 text-center">Usuarios alvo</th>
                <th className="px-3 py-2 text-center">Exam Guide</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cert) => (
                <tr key={cert.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-xs">{cert.code}</td>
                  <td className="px-3 py-2 text-sm">{cert.name}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[10px] ${
                        cert.active
                          ? "border-[#14532d] bg-green-900/20 text-green-400"
                          : "border-[#7f1d1d] bg-red-900/20 text-red-400"
                      }`}
                    >
                      {cert.active ? "sim" : "nao"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-xs">{cert._count.questions}</td>
                  <td className="px-3 py-2 text-center font-mono text-xs">{cert._count.userProfiles}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                        cert.hasExamGuide
                          ? "border-[#14532d] bg-green-900/20 text-green-300"
                          : "border-[#334155] text-[#64748b]"
                      }`}
                    >
                      {cert.hasExamGuide ? "Enviado" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/certificacoes/${cert.id}`)}
                      className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] transition-colors hover:border-[#f97316] hover:text-[#f97316]"
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                    Nenhuma certificacao encontrada.
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
