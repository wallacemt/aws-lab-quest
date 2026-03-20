"use client";

import { useEffect, useState } from "react";
import { listAdminQuestions } from "@/features/admin/services/admin-api";
import { AdminQuestionListItem, PaginatedResult } from "@/features/admin/types";

export function AdminQuestionsScreen() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaginatedResult<AdminQuestionListItem> | null>(null);

  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      setError(null);

      try {
        const data = await listAdminQuestions({ page, pageSize: 10, search });
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar questoes.");
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [page, search]);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-[var(--font-pixel)] text-xs uppercase text-[#f97316]">Questoes</p>
        <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[#f8fafc]">Banco de questoes paginavel</h1>
      </header>

      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <input
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder="Buscar por enunciado ou topico"
          className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
        />
      </section>

      {loading && <p className="text-sm text-[#94a3b8]">Carregando questoes...</p>}
      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

      {!loading && result && (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Enunciado</th>
                  <th className="px-3 py-2">Topico</th>
                  <th className="px-3 py-2">Dificuldade</th>
                  <th className="px-3 py-2">Uso</th>
                  <th className="px-3 py-2">Certificacao</th>
                  <th className="px-3 py-2">Servico</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b border-[#1e293b] text-[#e2e8f0]">
                    <td className="px-3 py-2">{item.statement.slice(0, 120)}...</td>
                    <td className="px-3 py-2">{item.topic}</td>
                    <td className="px-3 py-2 uppercase">{item.difficulty}</td>
                    <td className="px-3 py-2 uppercase">{item.usage}</td>
                    <td className="px-3 py-2">{item.certificationPreset?.code ?? "-"}</td>
                    <td className="px-3 py-2">{item.awsService?.code ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
            <span>
              Pagina {result.page} de {result.totalPages} | Total: {result.total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= result.totalPages}
                onClick={() => setPage((prev) => Math.min(result.totalPages, prev + 1))}
                className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
