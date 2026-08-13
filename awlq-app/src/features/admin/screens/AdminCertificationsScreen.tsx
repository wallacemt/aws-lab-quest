"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listAdminCertifications } from "@/features/admin/services/admin-api";
import type { AdminCertificationListItem } from "@/features/admin/types";

export function AdminCertificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AdminCertificationListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        </div>
      </header>

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
