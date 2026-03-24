"use client";

import { useEffect, useState } from "react";
import { listAdminQuestions } from "@/features/admin/services/admin-api";
import { AdminQuestionListItem, PaginatedResult } from "@/features/admin/types";

type CertificationOption = {
  id: string;
  code: string;
  name: string;
};

type AwsServiceOption = {
  id: string;
  code: string;
  name: string;
};

export function AdminQuestionsScreen() {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [usage, setUsage] = useState<"" | "KC" | "SIMULADO" | "BOTH">("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [certificationCode, setCertificationCode] = useState("");
  const [awsServiceCode, setAwsServiceCode] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "difficulty" | "usage" | "topic" | "externalId" | "active">(
    "createdAt",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaginatedResult<AdminQuestionListItem> | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<AdminQuestionListItem | null>(null);
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [awsServices, setAwsServices] = useState<AwsServiceOption[]>([]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [certificationsResponse, servicesResponse] = await Promise.all([
          fetch("/api/certifications", {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/study/services", {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        if (certificationsResponse.ok) {
          const certificationsPayload = (await certificationsResponse.json()) as {
            certifications?: CertificationOption[];
          };
          setCertifications(certificationsPayload.certifications ?? []);
        }

        if (servicesResponse.ok) {
          const servicesPayload = (await servicesResponse.json()) as {
            services?: AwsServiceOption[];
          };
          setAwsServices(servicesPayload.services ?? []);
        }
      } catch {
        // Keep table usable if filter options fail to load.
      }
    }

    void loadFilterOptions();
  }, []);

  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      setError(null);

      try {
        const data = await listAdminQuestions({
          page,
          pageSize: 10,
          search,
          difficulty: difficulty || undefined,
          usage: usage || undefined,
          active: active || undefined,
          certificationCode,
          awsServiceCode,
          sortBy,
          sortOrder,
        });
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar questoes.");
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [page, search, difficulty, usage, active, certificationCode, awsServiceCode, sortBy, sortOrder]);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Questoes</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Banco de questoes paginavel</h1>
      </header>

      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Buscar por enunciado, topico ou externalId"
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />

          <select
            value={difficulty}
            onChange={(event) => {
              setPage(1);
              setDifficulty(event.target.value as "" | "easy" | "medium" | "hard");
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todas as dificuldades</option>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>

          <select
            value={usage}
            onChange={(event) => {
              setPage(1);
              setUsage(event.target.value as "" | "KC" | "SIMULADO" | "BOTH");
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todos os usos</option>
            <option value="KC">KC</option>
            <option value="SIMULADO">SIMULADO</option>
            <option value="BOTH">BOTH</option>
          </select>

          <select
            value={active}
            onChange={(event) => {
              setPage(1);
              setActive(event.target.value as "" | "true" | "false");
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Ativas e inativas</option>
            <option value="true">Apenas ativas</option>
            <option value="false">Apenas inativas</option>
          </select>

          <select
            value={certificationCode}
            onChange={(event) => {
              setPage(1);
              setCertificationCode(event.target.value);
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todas as certificacoes</option>
            {certifications.map((certification) => (
              <option key={certification.id} value={certification.code}>
                {certification.code}
              </option>
            ))}
          </select>

          <select
            value={awsServiceCode}
            onChange={(event) => {
              setPage(1);
              setAwsServiceCode(event.target.value);
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todos os servicos AWS</option>
            {awsServices.map((service) => (
              <option key={service.id} value={service.code}>
                {service.code} - {service.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(event) => {
                setPage(1);
                setSortBy(
                  event.target.value as "createdAt" | "difficulty" | "usage" | "topic" | "externalId" | "active",
                );
              }}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            >
              <option value="createdAt">Criacao</option>
              <option value="difficulty">Dificuldade</option>
              <option value="usage">Uso</option>
              <option value="topic">Topico</option>
              <option value="externalId">External ID</option>
              <option value="active">Status</option>
            </select>

            <select
              value={sortOrder}
              onChange={(event) => {
                setPage(1);
                setSortOrder(event.target.value as "asc" | "desc");
              }}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
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
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]"
                    onClick={() => setSelectedQuestion(item)}
                  >
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

      {selectedQuestion && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-4xl space-y-4 rounded border border-[#334155] bg-[#111827] p-4 text-[#e2e8f0]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[#f97316]">Detalhes da questao</p>
                <p className="mt-1 text-sm">{selectedQuestion.externalId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuestion(null)}
                className="border border-[#334155] px-3 py-1 text-xs uppercase"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <p>
                <strong>Enunciado:</strong> {selectedQuestion.statement}
              </p>
              <p>
                <strong>Topico:</strong> {selectedQuestion.topic}
              </p>
              <p>
                <strong>Dificuldade:</strong> {selectedQuestion.difficulty.toUpperCase()} | <strong>Uso:</strong>{" "}
                {selectedQuestion.usage}
              </p>
              <p>
                <strong>Servico:</strong> {selectedQuestion.awsService?.code ?? "-"} | <strong>Certificacao:</strong>{" "}
                {selectedQuestion.certificationPreset?.code ?? "-"}
              </p>
            </div>

            <div className="grid gap-2 text-sm">
              <p className="font-mono text-xs uppercase text-[#94a3b8]">Alternativas</p>
              <p>A) {selectedQuestion.optionA}</p>
              <p>B) {selectedQuestion.optionB}</p>
              <p>C) {selectedQuestion.optionC}</p>
              <p>D) {selectedQuestion.optionD}</p>
              {selectedQuestion.optionE && <p>E) {selectedQuestion.optionE}</p>}
              <p className="mt-1 font-mono text-xs uppercase text-[#22c55e]">
                Gabarito: {selectedQuestion.correctOption}
              </p>
            </div>

            <div className="grid gap-2 text-sm">
              <p className="font-mono text-xs uppercase text-[#94a3b8]">Explicacoes</p>
              <p>A) {selectedQuestion.explanationA ?? "-"}</p>
              <p>B) {selectedQuestion.explanationB ?? "-"}</p>
              <p>C) {selectedQuestion.explanationC ?? "-"}</p>
              <p>D) {selectedQuestion.explanationD ?? "-"}</p>
              {selectedQuestion.optionE && <p>E) {selectedQuestion.explanationE ?? "-"}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
