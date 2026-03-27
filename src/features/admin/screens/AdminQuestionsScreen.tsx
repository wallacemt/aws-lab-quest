"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cleanupAdminQuestions,
  deleteAdminQuestion,
  listAdminQuestions,
  updateAdminQuestion,
} from "@/features/admin/services/admin-api";
import { AdminQuestionListItem, AdminQuestionUpdatePayload, PaginatedResult } from "@/features/admin/types";

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

type SortByOption = "createdAt" | "difficulty" | "usage" | "topic" | "externalId" | "active" | "questionType";

type ColumnKey =
  | "externalId"
  | "statement"
  | "topic"
  | "difficulty"
  | "questionType"
  | "usage"
  | "active"
  | "certification"
  | "service"
  | "createdAt";

const COLUMN_OPTIONS: Array<{ key: ColumnKey; label: string }> = [
  { key: "externalId", label: "External ID" },
  { key: "statement", label: "Enunciado" },
  { key: "topic", label: "Topico" },
  { key: "difficulty", label: "Dificuldade" },
  { key: "questionType", label: "Tipo" },
  { key: "usage", label: "Uso" },
  { key: "active", label: "Status" },
  { key: "certification", label: "Certificacao" },
  { key: "service", label: "Servico" },
  { key: "createdAt", label: "Criada em" },
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "statement",
  "topic",
  "difficulty",
  "questionType",
  "usage",
  "active",
  "certification",
  "service",
];

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

export function AdminQuestionsScreen() {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [questionType, setQuestionType] = useState<"" | "single" | "multi">("");
  const [usage, setUsage] = useState<"" | "KC" | "SIMULADO" | "BOTH">("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [certificationCode, setCertificationCode] = useState("");
  const [awsServiceCode, setAwsServiceCode] = useState("");
  const [sortBy, setSortBy] = useState<SortByOption>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [jumpPage, setJumpPage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<PaginatedResult<AdminQuestionListItem> | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<AdminQuestionListItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [awsServices, setAwsServices] = useState<AwsServiceOption[]>([]);

  const [editForm, setEditForm] = useState<{
    statement: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    questionType: "single" | "multi";
    usage: "KC" | "SIMULADO" | "BOTH";
    active: boolean;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    optionE: string;
    correctOption: string;
    correctOptions: string;
    explanationA: string;
    explanationB: string;
    explanationC: string;
    explanationD: string;
    explanationE: string;
  }>({
    statement: "",
    topic: "",
    difficulty: "easy",
    questionType: "single",
    usage: "BOTH",
    active: true,
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    optionE: "",
    correctOption: "A",
    correctOptions: "A",
    explanationA: "",
    explanationB: "",
    explanationC: "",
    explanationD: "",
    explanationE: "",
  });

  const selectedColumns = useMemo(() => {
    return COLUMN_OPTIONS.filter((column) => visibleColumns.includes(column.key));
  }, [visibleColumns]);

  function openQuestionModal(question: AdminQuestionListItem) {
    setSelectedQuestion(question);
    setEditMode(false);
    setModalError(null);
    setEditForm({
      statement: question.statement,
      topic: question.topic,
      difficulty: question.difficulty,
      questionType: question.questionType,
      usage: question.usage,
      active: question.active,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      optionE: question.optionE ?? "",
      correctOption: question.correctOption,
      correctOptions: (question.correctOptions ?? [question.correctOption]).join(","),
      explanationA: question.explanationA ?? "",
      explanationB: question.explanationB ?? "",
      explanationC: question.explanationC ?? "",
      explanationD: question.explanationD ?? "",
      explanationE: question.explanationE ?? "",
    });
  }

  function closeQuestionModal() {
    setSelectedQuestion(null);
    setEditMode(false);
    setModalError(null);
  }

  function toggleColumn(column: ColumnKey) {
    setVisibleColumns((previous) => {
      if (previous.includes(column)) {
        const next = previous.filter((item) => item !== column);
        return next.length > 0 ? next : previous;
      }

      return [...previous, column];
    });
  }

  function updateCurrentResultQuestion(updated: AdminQuestionListItem) {
    setResult((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        items: previous.items.map((item) => (item.id === updated.id ? updated : item)),
      };
    });
  }

  async function handleSaveQuestion() {
    if (!selectedQuestion) {
      return;
    }

    setSavingQuestion(true);
    setModalError(null);

    try {
      const parsedCorrectOptions = Array.from(
        new Set(
          editForm.correctOptions
            .split(",")
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean),
        ),
      );

      const payload: AdminQuestionUpdatePayload = {
        statement: editForm.statement,
        topic: editForm.topic,
        difficulty: editForm.difficulty,
        questionType: editForm.questionType,
        usage: editForm.usage,
        active: editForm.active,
        optionA: editForm.optionA,
        optionB: editForm.optionB,
        optionC: editForm.optionC,
        optionD: editForm.optionD,
        optionE: editForm.optionE || null,
        correctOption: editForm.correctOption,
        correctOptions: parsedCorrectOptions,
        explanationA: editForm.explanationA || null,
        explanationB: editForm.explanationB || null,
        explanationC: editForm.explanationC || null,
        explanationD: editForm.explanationD || null,
        explanationE: editForm.explanationE || null,
      };

      const updated = await updateAdminQuestion(selectedQuestion.id, payload);
      setSelectedQuestion(updated);
      updateCurrentResultQuestion(updated);
      setEditMode(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Falha ao salvar questao.");
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleDeleteQuestion() {
    if (!selectedQuestion) {
      return;
    }

    const shouldDelete = window.confirm("Deseja remover esta questao permanentemente?");
    if (!shouldDelete) {
      return;
    }

    setDeletingQuestion(true);
    setModalError(null);

    try {
      await deleteAdminQuestion(selectedQuestion.id);
      closeQuestionModal();
      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Falha ao remover questao.");
    } finally {
      setDeletingQuestion(false);
    }
  }

  async function handleCleanupIrregularQuestions() {
    const confirmed = window.confirm(
      "Essa acao remove automaticamente questoes irregulares/incompletas. Deseja continuar?",
    );
    if (!confirmed) {
      return;
    }

    setCleanupRunning(true);
    setCleanupResult(null);

    try {
      const payload = await cleanupAdminQuestions({ dryRun: false, limit: 7000 });
      setCleanupResult(
        `Escaneadas: ${payload.scanned} | Irregulares: ${payload.irregularCount} | Removidas: ${payload.removedCount}`,
      );
      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setCleanupResult(err instanceof Error ? err.message : "Falha ao tratar dados irregulares.");
    } finally {
      setCleanupRunning(false);
    }
  }

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
          pageSize,
          search,
          difficulty: difficulty || undefined,
          questionType: questionType || undefined,
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
  }, [
    page,
    pageSize,
    search,
    difficulty,
    questionType,
    usage,
    active,
    certificationCode,
    awsServiceCode,
    sortBy,
    sortOrder,
    refreshKey,
  ]);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Questoes</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Banco de questoes paginavel</h1>
        <button
          type="button"
          onClick={() => setRefreshKey((prev) => prev + 1)}
          className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0]"
        >
          Atualizar dados
        </button>
        <button
          type="button"
          disabled={cleanupRunning}
          onClick={() => void handleCleanupIrregularQuestions()}
          className="border border-[#7f1d1d] bg-red-900/20 px-3 py-1 text-xs uppercase text-red-200 disabled:opacity-60"
        >
          {cleanupRunning ? "Tratando dados..." : "Tratar dados irregulares"}
        </button>
        {cleanupResult && <p className="text-xs text-[#fbbf24]">{cleanupResult}</p>}
      </header>

      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
            value={questionType}
            onChange={(event) => {
              setPage(1);
              setQuestionType(event.target.value as "" | "single" | "multi");
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Tipos (single e multi)</option>
            <option value="single">single</option>
            <option value="multi">multi</option>
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

          <div className="grid grid-cols-2 gap-2 xl:col-span-2">
            <select
              value={sortBy}
              onChange={(event) => {
                setPage(1);
                setSortBy(event.target.value as SortByOption);
              }}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            >
              <option value="createdAt">Criacao</option>
              <option value="difficulty">Dificuldade</option>
              <option value="usage">Uso</option>
              <option value="topic">Topico</option>
              <option value="externalId">External ID</option>
              <option value="active">Status</option>
              <option value="questionType">Tipo</option>
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

          <label className="space-y-1 xl:col-span-1">
            <span className="font-mono text-[10px] uppercase text-[#94a3b8]">Itens por pagina</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            >
              {[10, 20, 30, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-2 border-t border-[#1e293b] pt-3">
          <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Dados exibidos na tabela</p>
          <div className="flex flex-wrap gap-3">
            {COLUMN_OPTIONS.map((column) => (
              <label key={column.key} className="inline-flex items-center gap-2 text-xs text-[#cbd5e1]">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column.key)}
                  onChange={() => toggleColumn(column.key)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {loading && <p className="text-sm text-[#94a3b8]">Carregando questoes...</p>}
      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

      {!loading && result && (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  {selectedColumns.map((column) => (
                    <th key={column.key} className="px-3 py-2">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-3 py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                    {selectedColumns.map((column) => {
                      if (column.key === "externalId") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2 font-mono text-xs">
                            {item.externalId}
                          </td>
                        );
                      }

                      if (column.key === "statement") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2">
                            {item.statement.slice(0, 140)}...
                          </td>
                        );
                      }

                      if (column.key === "topic") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2">
                            {item.topic}
                          </td>
                        );
                      }

                      if (column.key === "difficulty") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2 uppercase">
                            {item.difficulty}
                          </td>
                        );
                      }

                      if (column.key === "questionType") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2 uppercase">
                            {item.questionType}
                          </td>
                        );
                      }

                      if (column.key === "usage") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2 uppercase">
                            {item.usage}
                          </td>
                        );
                      }

                      if (column.key === "active") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2 uppercase">
                            {item.active ? "ATIVA" : "INATIVA"}
                          </td>
                        );
                      }

                      if (column.key === "certification") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2">
                            {item.certificationPreset?.code ?? "-"}
                          </td>
                        );
                      }

                      if (column.key === "service") {
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2">
                            {item.awsService?.code ?? "-"}
                          </td>
                        );
                      }

                      return (
                        <td key={`${item.id}-${column.key}`} className="px-3 py-2">
                          {formatDate(item.createdAt)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => openQuestionModal(item)}
                        className="border border-[#334155] px-2 py-1 text-[10px] uppercase"
                      >
                        Visualizar / editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-3 border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
            <span>
              Pagina {result.page} de {result.totalPages} | Total: {result.total} | Exibindo: {result.pageSize}
            </span>
            <div className="flex flex-wrap gap-2">
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
              <input
                value={jumpPage}
                onChange={(event) => setJumpPage(event.target.value.replace(/\D/g, ""))}
                placeholder="Ir"
                className="w-16 border border-[#334155] bg-[#0b1220] px-2 py-1 text-xs text-[#e2e8f0] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (!result) {
                    return;
                  }

                  const nextPage = Number(jumpPage);
                  if (!Number.isFinite(nextPage) || nextPage < 1) {
                    return;
                  }

                  setPage(Math.min(result.totalPages, nextPage));
                  setJumpPage("");
                }}
                className="border border-[#334155] px-3 py-1 text-xs uppercase"
              >
                Ir para pagina
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditMode((previous) => !previous)}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase"
                >
                  {editMode ? "Modo leitura" : "Editar"}
                </button>
                <button
                  type="button"
                  onClick={closeQuestionModal}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase"
                >
                  Fechar
                </button>
              </div>
            </div>

            {modalError && <p className="text-sm text-[#fca5a5]">{modalError}</p>}

            {!editMode ? (
              <>
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
                    <strong>Tipo:</strong> {selectedQuestion.questionType.toUpperCase()} | <strong>Status:</strong>{" "}
                    {selectedQuestion.active ? "ATIVA" : "INATIVA"}
                  </p>
                  <p>
                    <strong>Servico:</strong> {selectedQuestion.awsService?.code ?? "-"} |{" "}
                    <strong>Certificacao:</strong> {selectedQuestion.certificationPreset?.code ?? "-"}
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
                    Gabarito: {(selectedQuestion.correctOptions ?? [selectedQuestion.correctOption]).join(", ")}
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
              </>
            ) : (
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs uppercase text-[#94a3b8]">Enunciado</span>
                  <textarea
                    value={editForm.statement}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, statement: event.target.value }))}
                    className="min-h-[110px] w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Topico</span>
                  <input
                    value={editForm.topic}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, topic: event.target.value }))}
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Uso</span>
                  <select
                    value={editForm.usage}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, usage: event.target.value as "KC" | "SIMULADO" | "BOTH" }))
                    }
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  >
                    <option value="KC">KC</option>
                    <option value="SIMULADO">SIMULADO</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Dificuldade</span>
                  <select
                    value={editForm.difficulty}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        difficulty: event.target.value as "easy" | "medium" | "hard",
                      }))
                    }
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  >
                    <option value="easy">easy</option>
                    <option value="medium">medium</option>
                    <option value="hard">hard</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Tipo</span>
                  <select
                    value={editForm.questionType}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        questionType: event.target.value as "single" | "multi",
                      }))
                    }
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  >
                    <option value="single">single</option>
                    <option value="multi">multi</option>
                  </select>
                </label>

                <label className="inline-flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, active: event.target.checked }))}
                  />
                  <span className="text-xs uppercase text-[#94a3b8]">Questao ativa</span>
                </label>

                {(["A", "B", "C", "D", "E"] as const).map((letter) => (
                  <label key={letter} className="space-y-1 md:col-span-2">
                    <span className="text-xs uppercase text-[#94a3b8]">Alternativa {letter}</span>
                    <input
                      value={
                        letter === "A"
                          ? editForm.optionA
                          : letter === "B"
                            ? editForm.optionB
                            : letter === "C"
                              ? editForm.optionC
                              : letter === "D"
                                ? editForm.optionD
                                : editForm.optionE
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setEditForm((prev) => ({
                          ...prev,
                          ...(letter === "A"
                            ? { optionA: value }
                            : letter === "B"
                              ? { optionB: value }
                              : letter === "C"
                                ? { optionC: value }
                                : letter === "D"
                                  ? { optionD: value }
                                  : { optionE: value }),
                        }));
                      }}
                      className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                    />
                  </label>
                ))}

                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Gabarito principal</span>
                  <input
                    value={editForm.correctOption}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, correctOption: event.target.value.toUpperCase() }))
                    }
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm uppercase"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Respostas corretas (A,B)</span>
                  <input
                    value={editForm.correctOptions}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, correctOptions: event.target.value }))}
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm uppercase"
                  />
                </label>

                {(["A", "B", "C", "D", "E"] as const).map((letter) => (
                  <label key={`explanation-${letter}`} className="space-y-1 md:col-span-2">
                    <span className="text-xs uppercase text-[#94a3b8]">Explicacao {letter}</span>
                    <textarea
                      value={
                        letter === "A"
                          ? editForm.explanationA
                          : letter === "B"
                            ? editForm.explanationB
                            : letter === "C"
                              ? editForm.explanationC
                              : letter === "D"
                                ? editForm.explanationD
                                : editForm.explanationE
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setEditForm((prev) => ({
                          ...prev,
                          ...(letter === "A"
                            ? { explanationA: value }
                            : letter === "B"
                              ? { explanationB: value }
                              : letter === "C"
                                ? { explanationC: value }
                                : letter === "D"
                                  ? { explanationD: value }
                                  : { explanationE: value }),
                        }));
                      }}
                      className="min-h-[80px] w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-[#1e293b] pt-3">
              {editMode && (
                <button
                  type="button"
                  onClick={() => void handleSaveQuestion()}
                  disabled={savingQuestion}
                  className="border border-[#14532d] bg-green-900/20 px-3 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
                >
                  {savingQuestion ? "Salvando..." : "Salvar alteracoes"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDeleteQuestion()}
                disabled={deletingQuestion}
                className="border border-[#7f1d1d] bg-red-900/20 px-3 py-2 text-xs uppercase text-red-200 disabled:opacity-60"
              >
                {deletingQuestion ? "Removendo..." : "Remover questao"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
