"use client";

import { useEffect, useMemo, useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminQuestionsChartTab } from "@/features/admin/components/AdminQuestionsChartTab";
import { QuestionCreateModal, CreatedQuestion } from "@/features/admin/components/QuestionCreateModal";
import {
  batchAdminQuestions,
  deleteAdminQuestion,
  fillAdminQuestionsMissingWithAI,
  findAdminQuestionDuplicates,
  getAdminQuestionsFillMissingStats,
  listAdminQuestionReports,
  listAdminQuestions,
  updateAdminQuestionReportStatus,
  updateAdminQuestion,
  type DuplicateGroup,
} from "@/features/admin/services/admin-api";
import {
  AdminQuestionListItem,
  AdminQuestionReportListItem,
  AdminQuestionsFillMissingStats,
  AdminQuestionUpdatePayload,
  PaginatedResult,
} from "@/features/admin/types";

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

const UNASSIGNED_SERVICE_FILTER = "__UNASSIGNED__";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatReportReason(value: AdminQuestionReportListItem["reason"]): string {
  switch (value) {
    case "INCORRECT_ANSWER":
      return "Resposta incorreta";
    case "UNCLEAR_STATEMENT":
      return "Enunciado confuso";
    case "MISSING_CONTEXT":
      return "Falta de contexto";
    case "GRAMMAR_TYPO":
      return "Gramatica / typo";
    case "DUPLICATE":
      return "Questao duplicada";
    case "QUALITY_ISSUE":
      return "Problema de qualidade";
    default:
      return "Outro";
  }
}

function formatReportStatus(value: AdminQuestionReportListItem["status"]): string {
  switch (value) {
    case "OPEN":
      return "Aberta";
    case "IN_REVIEW":
      return "Em revisao";
    case "RESOLVED":
      return "Resolvida";
    default:
      return "Descartada";
  }
}

function toInitials(name: string): string {
  const parts = name
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function resolveQuestionOptions(question: AdminQuestionListItem) {
  const labels = ["A", "B", "C", "D", "E"] as const;
  const legacyCorrect = question.correctOptions ?? [question.correctOption];

  return labels.map((label) => {
    const fromPayload = question.options?.find((item) => item.label === label);
    const content =
      fromPayload?.content ??
      (label === "A"
        ? question.optionA
        : label === "B"
          ? question.optionB
          : label === "C"
            ? question.optionC
            : label === "D"
              ? question.optionD
              : question.optionE);

    const explanation =
      fromPayload?.explanation ??
      (label === "A"
        ? question.explanationA
        : label === "B"
          ? question.explanationB
          : label === "C"
            ? question.explanationC
            : label === "D"
              ? question.explanationD
              : question.explanationE);

    return {
      label,
      content,
      explanation,
      isCorrect: fromPayload?.isCorrect ?? legacyCorrect.includes(label),
    };
  });
}

export function AdminQuestionsScreen() {
  const [activeTab, setActiveTab] = useState<"lista" | "graficos">("lista");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [questionType, setQuestionType] = useState<"" | "single" | "multi">("");
  const [usage, setUsage] = useState<"" | "KC" | "SIMULADO" | "BOTH">("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [certificationCode, setCertificationCode] = useState("");
  const [awsServiceCode, setAwsServiceCode] = useState("");
  const [reportStatus, setReportStatus] = useState<"" | "REPORTED" | "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED">(
    "",
  );
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
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [aiFillRunning, setAiFillRunning] = useState(false);
  const [bulkUsage, setBulkUsage] = useState<"KC" | "SIMULADO" | "BOTH">("BOTH");
  const [bulkResultMessage, setBulkResultMessage] = useState<string | null>(null);
  const [aiFillModalOpen, setAiFillModalOpen] = useState(false);
  const [aiFillStatsLoading, setAiFillStatsLoading] = useState(false);
  const [aiFillStatsError, setAiFillStatsError] = useState<string | null>(null);
  const [aiFillStats, setAiFillStats] = useState<AdminQuestionsFillMissingStats | null>(null);
  const [aiFillTotalToProcess, setAiFillTotalToProcess] = useState("10");
  const [aiFillChunkSize, setAiFillChunkSize] = useState("10");
  const [aiFillDelayMs, setAiFillDelayMs] = useState("1600");
  const [aiFillDryRun, setAiFillDryRun] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [allAwsServices, setAllAwsServices] = useState<AwsServiceOption[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [reportsPanelOpen, setReportsPanelOpen] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsPageSize] = useState(5);
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);
  const [reportActionRunningId, setReportActionRunningId] = useState<string | null>(null);
  const [reportsResult, setReportsResult] = useState<PaginatedResult<AdminQuestionReportListItem> | null>(null);
  const [newQuestionModalOpen, setNewQuestionModalOpen] = useState(false);
  const [jsonImportModalOpen, setJsonImportModalOpen] = useState(false);
  const [jsonImportText, setJsonImportText] = useState("");
  const [jsonImportDefaultCert, setJsonImportDefaultCert] = useState("");
  const [jsonImportGuideOpen, setJsonImportGuideOpen] = useState(false);
  const [jsonImportLoading, setJsonImportLoading] = useState(false);
  const [jsonImportError, setJsonImportError] = useState<string | null>(null);
  const [jsonImportSuccess, setJsonImportSuccess] = useState<string | null>(null);
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);
  const [duplicatesGroups, setDuplicatesGroups] = useState<DuplicateGroup[]>([]);
  const [duplicatesMethod, setDuplicatesMethod] = useState<string>("");
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<string[]>([]);
  const [jsonImportPreviewList, setJsonImportPreviewList] = useState<
    Array<{
      id: string;
      selected: boolean;
      index: number;
      statement: string;
      difficulty: string;
      questionType: string;
      certificationCode: string | null;
      services: string[];
      raw: Record<string, unknown>;
    }>
  >([]);
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
    serviceCodes: string[];
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
    serviceCodes: [],
  });

  const selectedColumns = useMemo(() => {
    return COLUMN_OPTIONS.filter((column) => visibleColumns.includes(column.key));
  }, [visibleColumns]);

  const selectedQuestionOptions = useMemo(() => {
    if (!selectedQuestion) {
      return [] as ReturnType<typeof resolveQuestionOptions>;
    }

    return resolveQuestionOptions(selectedQuestion);
  }, [selectedQuestion]);

  const filteredAwsServices = useMemo(() => {
    const normalizedSearch = normalizeForSearch(serviceSearch);

    if (!normalizedSearch) {
      return allAwsServices;
    }

    return allAwsServices
      .filter((service) => normalizeForSearch(`${service.code} ${service.name}`).includes(normalizedSearch))
      .sort((a, b) => {
        const aCodeStarts = normalizeForSearch(a.code).startsWith(normalizedSearch) ? 1 : 0;
        const bCodeStarts = normalizeForSearch(b.code).startsWith(normalizedSearch) ? 1 : 0;
        if (aCodeStarts !== bCodeStarts) {
          return bCodeStarts - aCodeStarts;
        }

        const aNameStarts = normalizeForSearch(a.name).startsWith(normalizedSearch) ? 1 : 0;
        const bNameStarts = normalizeForSearch(b.name).startsWith(normalizedSearch) ? 1 : 0;
        if (aNameStarts !== bNameStarts) {
          return bNameStarts - aNameStarts;
        }

        return a.code.localeCompare(b.code, "pt-BR");
      });
  }, [allAwsServices, serviceSearch]);

  const currentPageIds = useMemo(() => result?.items.map((item) => item.id) ?? [], [result]);
  const selectedOnPageCount = useMemo(
    () => currentPageIds.filter((id) => selectedQuestionIds.includes(id)).length,
    [currentPageIds, selectedQuestionIds],
  );
  const allSelectedOnPage = currentPageIds.length > 0 && selectedOnPageCount === currentPageIds.length;

  function toggleSelectQuestion(questionId: string) {
    setSelectedQuestionIds((previous) => {
      if (previous.includes(questionId)) {
        return previous.filter((id) => id !== questionId);
      }

      return [...previous, questionId];
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedQuestionIds((previous) => {
      if (currentPageIds.length === 0) {
        return previous;
      }

      const selectedSet = new Set(previous);
      const allSelected = currentPageIds.every((id) => selectedSet.has(id));

      if (allSelected) {
        return previous.filter((id) => !currentPageIds.includes(id));
      }

      for (const id of currentPageIds) {
        selectedSet.add(id);
      }

      return Array.from(selectedSet);
    });
  }

  function openQuestionModal(question: AdminQuestionListItem) {
    const resolvedOptions = resolveQuestionOptions(question);
    const optionByLabel = Object.fromEntries(resolvedOptions.map((item) => [item.label, item])) as Record<
      "A" | "B" | "C" | "D" | "E",
      { label: "A" | "B" | "C" | "D" | "E"; content: string | null; explanation: string | null; isCorrect: boolean }
    >;
    const computedCorrectOptions = resolvedOptions.filter((item) => item.isCorrect).map((item) => item.label);
    const serviceCodes = Array.from(
      new Set([
        ...(question.awsServices?.map((service) => service.code) ?? []),
        ...(question.awsService?.code ? [question.awsService.code] : []),
      ]),
    );

    setSelectedQuestion(question);
    setEditMode(false);
    setModalError(null);
    setServiceSearch("");
    setReportsPanelOpen(false);
    setReportsLoading(false);
    setReportsError(null);
    setReportsPage(1);
    setReportsRefreshKey(0);
    setReportActionRunningId(null);
    setReportsResult(null);
    setEditForm({
      statement: question.statement,
      topic: question.topic,
      difficulty: question.difficulty,
      questionType: question.questionType,
      usage: question.usage,
      active: question.active,
      optionA: optionByLabel.A.content ?? "",
      optionB: optionByLabel.B.content ?? "",
      optionC: optionByLabel.C.content ?? "",
      optionD: optionByLabel.D.content ?? "",
      optionE: optionByLabel.E.content ?? "",
      correctOption: computedCorrectOptions[0] ?? question.correctOption,
      correctOptions: (computedCorrectOptions.length > 0 ? computedCorrectOptions : [question.correctOption]).join(","),
      explanationA: optionByLabel.A.explanation ?? "",
      explanationB: optionByLabel.B.explanation ?? "",
      explanationC: optionByLabel.C.explanation ?? "",
      explanationD: optionByLabel.D.explanation ?? "",
      explanationE: optionByLabel.E.explanation ?? "",
      serviceCodes,
    });
  }

  function toggleServiceCode(serviceCode: string) {
    setEditForm((previous) => {
      if (previous.serviceCodes.includes(serviceCode)) {
        return {
          ...previous,
          serviceCodes: previous.serviceCodes.filter((code) => code !== serviceCode),
        };
      }

      return {
        ...previous,
        serviceCodes: [...previous.serviceCodes, serviceCode],
      };
    });
  }

  function closeQuestionModal() {
    setSelectedQuestion(null);
    setEditMode(false);
    setModalError(null);
    setServiceSearch("");
    setReportsPanelOpen(false);
    setReportsLoading(false);
    setReportsError(null);
    setReportsPage(1);
    setReportsRefreshKey(0);
    setReportActionRunningId(null);
    setReportsResult(null);
  }

  function toggleReportsPanel() {
    setReportsPanelOpen((previous) => {
      const next = !previous;
      if (next) {
        setReportsPage(1);
      }

      return next;
    });
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

  function updateQuestionReportCounters(input: { reportCount: number; openReportCount: number }) {
    setSelectedQuestion((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        reportCount: input.reportCount,
        openReportCount: input.openReportCount,
      };
    });

    setResult((previous) => {
      if (!previous || !selectedQuestion) {
        return previous;
      }

      return {
        ...previous,
        items: previous.items.map((item) => {
          if (item.id !== selectedQuestion.id) {
            return item;
          }

          return {
            ...item,
            reportCount: input.reportCount,
            openReportCount: input.openReportCount,
          };
        }),
      };
    });
  }

  async function moderateReportStatus(reportId: string, status: "RESOLVED" | "DISMISSED") {
    if (!selectedQuestion) {
      return;
    }

    const actionLabel = status === "RESOLVED" ? "marcar como resolvida" : "descartar";
    const confirmed = window.confirm(`Deseja ${actionLabel} esta denuncia?`);
    if (!confirmed) {
      return;
    }

    setReportActionRunningId(reportId);
    setReportsError(null);

    try {
      const updated = await updateAdminQuestionReportStatus(selectedQuestion.id, reportId, { status });
      updateQuestionReportCounters({
        reportCount: updated.question.reportCount,
        openReportCount: updated.question.openReportCount,
      });
      setReportsRefreshKey((previous) => previous + 1);
    } catch (error) {
      setReportsError(error instanceof Error ? error.message : "Falha ao atualizar status da denuncia.");
    } finally {
      setReportActionRunningId(null);
    }
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

      const normalizedOptionRows: AdminQuestionUpdatePayload["options"] = [
        {
          label: "A",
          content: editForm.optionA,
          explanation: editForm.explanationA || null,
          isCorrect: parsedCorrectOptions.includes("A"),
        },
        {
          label: "B",
          content: editForm.optionB,
          explanation: editForm.explanationB || null,
          isCorrect: parsedCorrectOptions.includes("B"),
        },
        {
          label: "C",
          content: editForm.optionC,
          explanation: editForm.explanationC || null,
          isCorrect: parsedCorrectOptions.includes("C"),
        },
        {
          label: "D",
          content: editForm.optionD,
          explanation: editForm.explanationD || null,
          isCorrect: parsedCorrectOptions.includes("D"),
        },
        {
          label: "E",
          content: editForm.optionE || null,
          explanation: editForm.explanationE || null,
          isCorrect: parsedCorrectOptions.includes("E"),
        },
      ];

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
        options: normalizedOptionRows,
        serviceCodes: editForm.serviceCodes,
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
      setSelectedQuestionIds((previous) => previous.filter((id) => id !== selectedQuestion.id));
      closeQuestionModal();
      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Falha ao remover questao.");
    } finally {
      setDeletingQuestion(false);
    }
  }

  async function runBulkAction(
    action: "set-active" | "set-usage" | "delete",
    input?: { active?: boolean; usage?: "KC" | "SIMULADO" | "BOTH" },
  ) {
    if (selectedQuestionIds.length === 0) {
      setBulkResultMessage("Selecione ao menos uma questao.");
      return;
    }

    setBulkRunning(true);
    setBulkResultMessage(null);

    try {
      const payload = {
        ids: selectedQuestionIds,
        action,
        ...(input?.active !== undefined ? { active: input.active } : {}),
        ...(input?.usage ? { usage: input.usage } : {}),
      };

      const result = await batchAdminQuestions(payload);
      setBulkResultMessage(`Acao em lote concluida. Solicitadas: ${result.requested} | Afetadas: ${result.affected}`);
      setSelectedQuestionIds([]);
      setRefreshKey((previous) => previous + 1);
    } catch (error) {
      setBulkResultMessage(error instanceof Error ? error.message : "Falha na acao em lote.");
    } finally {
      setBulkRunning(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedQuestionIds.length === 0) {
      setBulkResultMessage("Selecione ao menos uma questao.");
      return;
    }

    const confirmed = window.confirm(`Remover ${selectedQuestionIds.length} questoes selecionadas?`);
    if (!confirmed) {
      return;
    }

    await runBulkAction("delete");
  }

  async function handleFillMissingWithAI() {
    setAiFillStatsLoading(true);
    setAiFillStatsError(null);
    setBulkResultMessage(null);

    try {
      const stats = await getAdminQuestionsFillMissingStats();
      setAiFillStats(stats);
      setAiFillTotalToProcess(String(Math.min(10, Math.max(1, stats.pending))));
      setAiFillChunkSize(String(stats.defaultChunkSize));
      setAiFillDelayMs(String(stats.defaultDelayMs));
      setAiFillDryRun(false);
      setAiFillModalOpen(true);
    } catch (error) {
      setAiFillStatsError(error instanceof Error ? error.message : "Falha ao carregar pendencias para IA.");
    } finally {
      setAiFillStatsLoading(false);
    }
  }

  async function submitAiFillModal() {
    const pending = aiFillStats?.pending ?? 0;
    if (pending <= 0) {
      setAiFillStatsError("Nao existem questoes pendentes para preencher.");
      return;
    }

    const totalRaw = Number(aiFillTotalToProcess);
    const chunkRaw = Number(aiFillChunkSize);
    const delayRaw = Number(aiFillDelayMs);

    if (!Number.isFinite(totalRaw) || totalRaw < 1) {
      setAiFillStatsError("Informe uma quantidade valida para processar.");
      return;
    }

    if (!Number.isFinite(chunkRaw) || chunkRaw < 1 || chunkRaw > 10) {
      setAiFillStatsError("Tamanho do lote por requisicao deve ser entre 1 e 10.");
      return;
    }

    if (!Number.isFinite(delayRaw) || delayRaw < 0) {
      setAiFillStatsError("Delay invalido. Informe 0 ou mais milissegundos.");
      return;
    }

    const totalToProcess = Math.min(Math.floor(totalRaw), pending, aiFillStats?.maxTotalPerRun ?? pending);
    const chunkSize = Math.min(10, Math.floor(chunkRaw));
    const delayMs = Math.max(0, Math.floor(delayRaw));

    setAiFillRunning(true);
    setAiFillStatsError(null);
    setBulkResultMessage(null);

    try {
      const result = await fillAdminQuestionsMissingWithAI({
        totalToProcess,
        chunkSize,
        delayMs,
        dryRun: aiFillDryRun,
      });

      setBulkResultMessage(
        `IA executada. Solicitadas: ${result.requestedTotal ?? totalToProcess} | Processadas: ${result.processed} | Atualizadas: ${result.updated} | Sem alteracao: ${result.touched ?? 0} | Requisicoes IA: ${result.aiRequests ?? 0}${result.dryRun ? " | dry-run" : ""}`,
      );
      setAiFillModalOpen(false);
      setRefreshKey((previous) => previous + 1);
    } catch (error) {
      setAiFillStatsError(error instanceof Error ? error.message : "Falha ao preencher questoes faltantes com IA.");
    } finally {
      setAiFillRunning(false);
    }
  }

  async function handleFindDuplicates() {
    setDuplicatesLoading(true);
    setDuplicatesError(null);
    setDuplicatesGroups([]);
    setSelectedDuplicateIds([]);
    try {
      const data = await findAdminQuestionDuplicates(certificationCode || undefined);
      setDuplicatesGroups(data.groups);
      setDuplicatesMethod(data.method);
      setDuplicatesModalOpen(true);
    } catch (err) {
      setDuplicatesError(err instanceof Error ? err.message : "Falha ao buscar duplicatas.");
    } finally {
      setDuplicatesLoading(false);
    }
  }

  function toggleDuplicateId(id: string) {
    setSelectedDuplicateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleDeleteSelectedDuplicates() {
    if (selectedDuplicateIds.length === 0) return;
    const confirmed = window.confirm(
      `Remover ${selectedDuplicateIds.length} questoes duplicadas selecionadas?`,
    );
    if (!confirmed) return;
    setBulkRunning(true);
    setBulkResultMessage(null);
    try {
      const result = await batchAdminQuestions({ ids: selectedDuplicateIds, action: "delete" });
      setBulkResultMessage(
        `Duplicatas removidas. Solicitadas: ${result.requested} | Afetadas: ${result.affected}`,
      );
      setSelectedDuplicateIds([]);
      setDuplicatesModalOpen(false);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      setDuplicatesError(error instanceof Error ? error.message : "Falha ao remover duplicatas.");
    } finally {
      setBulkRunning(false);
    }
  }

  function handleJsonImportPreview() {
    setJsonImportError(null);
    setJsonImportSuccess(null);
    setJsonImportPreviewList([]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonImportText.trim());
    } catch {
      setJsonImportError("JSON invalido. Verifique a sintaxe.");
      return;
    }

    const questions = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>)?.questions;
    if (!Array.isArray(questions)) {
      setJsonImportError("Esperado array de questoes ou { questions: [...] }");
      return;
    }

    if (questions.length === 0) {
      setJsonImportError("Lista de questoes vazia.");
      return;
    }

    if (questions.length > 200) {
      setJsonImportError("Maximo 200 questoes por importacao.");
      return;
    }

    const items = questions.map((q, i) => {
      const item = (q ?? {}) as Record<string, unknown>;
      const statement = String(item.statement ?? "").trim();
      const difficulty = String(item.difficulty ?? "medium");
      const questionType = String(item.questionType ?? "single");
      const certCode =
        String(item.certificationCode ?? jsonImportDefaultCert ?? "").trim() || null;
      const rawServices =
        (item.awsServiceNames as string[] | undefined) ??
        (item.awsServiceCodes as string[] | undefined) ??
        [];
      const services = Array.isArray(rawServices) ? rawServices.map(String) : [];
      return {
        id: `preview-${i}-${Math.random().toString(36).slice(2, 6)}`,
        selected: true,
        index: i + 1,
        statement,
        difficulty,
        questionType,
        certificationCode: certCode,
        services,
        raw: item,
      };
    });

    setJsonImportPreviewList(items);
  }

  async function handleJsonImportSave() {
    const selected = jsonImportPreviewList.filter((item) => item.selected);
    if (selected.length === 0) {
      setJsonImportError("Selecione ao menos uma questao para importar.");
      return;
    }

    setJsonImportError(null);
    setJsonImportSuccess(null);
    setJsonImportLoading(true);

    try {
      const res = await fetch("/api/admin/questions/import-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questions: selected.map((item) => item.raw),
          defaultCertificationCode: jsonImportDefaultCert || undefined,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const errMsg = Array.isArray(data.errors)
          ? (data.errors as string[]).slice(0, 5).join(" | ")
          : String(data.error ?? "Erro desconhecido");
        setJsonImportError(errMsg);
      } else {
        setJsonImportSuccess(`${String(data.created)} questoes importadas com sucesso.`);
        setJsonImportText("");
        setJsonImportPreviewList([]);
        setRefreshKey((prev) => prev + 1);
      }
    } catch {
      setJsonImportError("Falha na requisicao");
    } finally {
      setJsonImportLoading(false);
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
          setAllAwsServices(servicesPayload.services ?? []);
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
          reportStatus: reportStatus || undefined,
          sortBy,
          sortOrder,
          createdFrom: dateRange?.from ? startOfDay(dateRange.from).toISOString().slice(0, 10) : undefined,
          createdTo: dateRange?.to ? endOfDay(dateRange.to).toISOString().slice(0, 10) : dateRange?.from ? endOfDay(dateRange.from).toISOString().slice(0, 10) : undefined,
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
    reportStatus,
    sortBy,
    sortOrder,
    refreshKey,
    dateRange,
  ]);

  useEffect(() => {
    if (!result) {
      return;
    }

    const pageIds = new Set(result.items.map((item) => item.id));
    setSelectedQuestionIds((previous) => previous.filter((id) => pageIds.has(id) || !currentPageIds.includes(id)));
  }, [currentPageIds, result]);

  useEffect(() => {
    if (!selectedQuestion || !reportsPanelOpen) {
      return;
    }

    const selectedQuestionId = selectedQuestion.id;

    let cancelled = false;

    async function loadQuestionReports() {
      setReportsLoading(true);
      setReportsError(null);

      try {
        const data = await listAdminQuestionReports(selectedQuestionId, {
          page: reportsPage,
          pageSize: reportsPageSize,
        });

        if (!cancelled) {
          setReportsResult(data);
        }
      } catch (err) {
        if (!cancelled) {
          setReportsError(err instanceof Error ? err.message : "Falha ao carregar denuncias.");
          setReportsResult(null);
        }
      } finally {
        if (!cancelled) {
          setReportsLoading(false);
        }
      }
    }

    void loadQuestionReports();

    return () => {
      cancelled = true;
    };
  }, [reportsPage, reportsPageSize, reportsPanelOpen, reportsRefreshKey, selectedQuestion]);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Questoes</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Banco de questoes paginavel</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0]"
          >
            Atualizar dados
          </button>
          <button
            type="button"
            disabled={bulkRunning || selectedQuestionIds.length === 0}
            onClick={() => void runBulkAction("set-active", { active: true })}
            className="border border-[#14532d] bg-green-900/20 px-3 py-1 text-xs uppercase text-green-200 disabled:opacity-60"
          >
            {bulkRunning ? "Processando..." : "Ativar selecionadas"}
          </button>
          <button
            type="button"
            disabled={bulkRunning || selectedQuestionIds.length === 0}
            onClick={() => void runBulkAction("set-active", { active: false })}
            className="border border-[#7f1d1d] bg-red-900/20 px-3 py-1 text-xs uppercase text-red-200 disabled:opacity-60"
          >
            {bulkRunning ? "Processando..." : "Inativar selecionadas"}
          </button>
          <select
            value={bulkUsage}
            onChange={(event) => setBulkUsage(event.target.value as "KC" | "SIMULADO" | "BOTH")}
            className="border border-[#334155] bg-[#0b1220] px-3 py-1 text-xs uppercase text-[#e2e8f0] outline-none"
          >
            <option value="KC">Uso: KC</option>
            <option value="SIMULADO">Uso: SIMULADO</option>
            <option value="BOTH">Uso: BOTH</option>
          </select>
          <button
            type="button"
            disabled={bulkRunning || selectedQuestionIds.length === 0}
            onClick={() => void runBulkAction("set-usage", { usage: bulkUsage })}
            className="border border-[#334155] bg-[#0b1220] px-3 py-1 text-xs uppercase text-[#e2e8f0] disabled:opacity-60"
          >
            {bulkRunning ? "Processando..." : "Aplicar uso selecionado"}
          </button>
          <button
            type="button"
            disabled={bulkRunning || selectedQuestionIds.length === 0}
            onClick={() => void handleBulkDelete()}
            className="border border-[#7f1d1d] bg-red-900/20 px-3 py-1 text-xs uppercase text-red-200 disabled:opacity-60"
          >
            {bulkRunning ? "Processando..." : "Remover selecionadas"}
          </button>
          <button
            type="button"
            disabled={aiFillRunning || bulkRunning}
            onClick={() => void handleFillMissingWithAI()}
            className="border border-[#334155] bg-[#0b1220] px-3 py-1 text-xs uppercase text-[#fbbf24] disabled:opacity-60"
          >
            {aiFillStatsLoading
              ? "Carregando pendencias..."
              : aiFillRunning
                ? "IA em execucao..."
                : "Preencher faltantes com IA"}
          </button>
          <button
            type="button"
            onClick={() => setNewQuestionModalOpen(true)}
            className="border border-[#14532d] bg-green-900/10 px-3 py-1 text-xs uppercase text-green-300"
          >
            + Nova questao
          </button>
          <button
            type="button"
            onClick={() => {
              setJsonImportModalOpen(true);
              setJsonImportError(null);
              setJsonImportSuccess(null);
              setJsonImportPreviewList([]);
            }}
            className="border border-[#1e3a5f] bg-blue-900/20 px-3 py-1 text-xs uppercase text-[#38bdf8]"
          >
            Importar JSON
          </button>
          <button
            type="button"
            disabled={duplicatesLoading}
            onClick={() => void handleFindDuplicates()}
            className="border border-[#334155] bg-[#0b1220] px-3 py-1 text-xs uppercase text-[#f97316] disabled:opacity-60"
          >
            {duplicatesLoading ? "Buscando..." : "Encontrar duplicatas"}
          </button>
        </div>
        <p className="text-xs text-[#94a3b8]">
          Selecionadas: {selectedQuestionIds.length} (na pagina: {selectedOnPageCount})
        </p>
        {bulkResultMessage && <p className="text-xs text-[#fbbf24]">{bulkResultMessage}</p>}
        {aiFillStatsError && <p className="text-xs text-[#fca5a5]">{aiFillStatsError}</p>}
        {duplicatesError && <p className="text-xs text-[#fca5a5]">{duplicatesError}</p>}
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
            <option value={UNASSIGNED_SERVICE_FILTER}>Sem servico vinculado</option>
            {allAwsServices.map((service) => (
              <option key={service.id} value={service.code}>
                {service.code} - {service.name}
              </option>
            ))}
          </select>

          <select
            value={reportStatus}
            onChange={(event) => {
              setPage(1);
              setReportStatus(event.target.value as "" | "REPORTED" | "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED");
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Denuncias: todas</option>
            <option value="REPORTED">Com denuncia ativa</option>
            <option value="OPEN">Denuncia aberta</option>
            <option value="IN_REVIEW">Em revisao</option>
            <option value="RESOLVED">Resolvida</option>
            <option value="DISMISSED">Descartada</option>
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

        {/* Date range picker */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#1e293b] pt-3">
          <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Período de criação:</p>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 border border-[#334155] bg-[#0b1220] px-3 py-1.5 text-xs text-[#e2e8f0] hover:border-[#4a5568]"
              >
                <span>
                  {dateRange?.from
                    ? dateRange.to && dateRange.to.toDateString() !== dateRange.from.toDateString()
                      ? `${format(dateRange.from, "dd/MM/yy", { locale: ptBR })} → ${format(dateRange.to, "dd/MM/yy", { locale: ptBR })}`
                      : format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    : "Filtrar por data"}
                </span>
                <span className="text-[#64748b]">▾</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto border border-[#334155] bg-[#000] p-0 text-[#e2e8f0]"
              align="start"
            >
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  setPage(1);
                  if (range?.from && range?.to) setCalendarOpen(false);
                }}
                locale={ptBR}
                className="rounded-none"
                classNames={{
                  months: "flex flex-col sm:flex-row gap-4 p-3",
                  month: "space-y-2",
                  month_caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-mono uppercase text-[#94a3b8]",
                  nav: "flex items-center justify-between absolute inset-x-0 top-0",
                  button_previous: "h-7 w-7 bg-transparent border border-[#334155] text-[#94a3b8] hover:text-[#e2e8f0] flex items-center justify-center absolute left-1",
                  button_next: "h-7 w-7 bg-transparent border border-[#334155] text-[#94a3b8] hover:text-[#e2e8f0] flex items-center justify-center absolute right-1",
                  month_grid: "w-full border-collapse",
                  weekdays: "flex",
                  weekday: "text-[#475569] rounded-none w-9 font-mono text-[10px] uppercase",
                  week: "flex w-full mt-1",
                  day: "h-9 w-9 text-center text-xs relative [&:has([aria-selected])]:bg-[#1e293b] first:[&:has([aria-selected])]:rounded-l-none last:[&:has([aria-selected])]:rounded-r-none focus-within:relative focus-within:z-20",
                  day_button: "h-9 w-9 p-0 font-mono text-xs text-[#cbd5e1] hover:bg-[#1e293b] hover:text-[#f8fafc] aria-selected:opacity-100",
                  selected: "bg-[#f97316] text-black hover:bg-[#ea6c00] hover:text-black focus:bg-[#f97316] focus:text-black",
                  today: "border border-[#f97316] text-[#f97316]",
                  outside: "text-[#334155] opacity-50",
                  disabled: "text-[#334155] opacity-30",
                  range_middle: "aria-selected:bg-[#1e293b] aria-selected:text-[#e2e8f0]",
                  range_end: "range-end",
                  hidden: "invisible",
                }}
              />
              <div className="flex flex-wrap gap-2 border-t border-[#1e293b] p-3">
                <button
                  type="button"
                  onClick={() => { setDateRange({ from: new Date(), to: new Date() }); setPage(1); setCalendarOpen(false); }}
                  className="border border-[#334155] px-2 py-1 text-[10px] uppercase text-[#94a3b8] hover:text-[#e2e8f0]"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => { setDateRange({ from: subDays(new Date(), 6), to: new Date() }); setPage(1); setCalendarOpen(false); }}
                  className="border border-[#334155] px-2 py-1 text-[10px] uppercase text-[#94a3b8] hover:text-[#e2e8f0]"
                >
                  7 dias
                </button>
                <button
                  type="button"
                  onClick={() => { setDateRange({ from: subDays(new Date(), 29), to: new Date() }); setPage(1); setCalendarOpen(false); }}
                  className="border border-[#334155] px-2 py-1 text-[10px] uppercase text-[#94a3b8] hover:text-[#e2e8f0]"
                >
                  30 dias
                </button>
                <button
                  type="button"
                  onClick={() => { setDateRange(undefined); setPage(1); setCalendarOpen(false); }}
                  className="border border-[#7f1d1d] px-2 py-1 text-[10px] uppercase text-[#fca5a5] hover:text-[#fecaca]"
                >
                  Limpar
                </button>
              </div>
            </PopoverContent>
          </Popover>
          {dateRange?.from && (
            <button
              type="button"
              onClick={() => { setDateRange(undefined); setPage(1); }}
              className="text-[10px] uppercase text-[#64748b] hover:text-[#fca5a5]"
            >
              ✕ limpar data
            </button>
          )}
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

      {/* Tab navigation */}
      <div className="flex border-b border-[#1e293b]">
        <button
          type="button"
          onClick={() => setActiveTab("lista")}
          className={`border-b-2 px-4 py-2 text-xs font-mono uppercase transition-colors ${activeTab === "lista" ? "border-[#f97316] text-[#f97316]" : "border-transparent text-[#64748b] hover:text-[#e2e8f0]"}`}
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("graficos")}
          className={`border-b-2 px-4 py-2 text-xs font-mono uppercase transition-colors ${activeTab === "graficos" ? "border-[#f97316] text-[#f97316]" : "border-transparent text-[#64748b] hover:text-[#e2e8f0]"}`}
        >
          Graficos
        </button>
      </div>

      {activeTab === "lista" && loading && <p className="text-sm text-[#94a3b8]">Carregando questoes...</p>}
      {activeTab === "lista" && error && <p className="text-sm text-[#fca5a5]">{error}</p>}

      {activeTab === "lista" && !loading && result && (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">
                    <input type="checkbox" checked={allSelectedOnPage} onChange={toggleSelectAllOnPage} />
                  </th>
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
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(item.id)}
                        onChange={() => toggleSelectQuestion(item.id)}
                      />
                    </td>
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
                            <div className="space-y-1">
                              <p>{item.active ? "ATIVA" : "INATIVA"}</p>
                              {(item.reportCount ?? 0) > 0 && (
                                <p className="text-[10px] text-[#fbbf24]">
                                  Denuncias: {item.reportCount}
                                  {(item.openReportCount ?? 0) > 0 ? ` (abertas: ${item.openReportCount})` : ""}
                                </p>
                              )}
                            </div>
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
                        const serviceCodes = Array.from(
                          new Set([
                            ...(item.awsServices?.map((service) => service.code) ?? []),
                            ...(item.awsService?.code ? [item.awsService.code] : []),
                          ]),
                        );
                        return (
                          <td key={`${item.id}-${column.key}`} className="px-3 py-2">
                            {serviceCodes.length > 0 ? serviceCodes.join(", ") : "-"}
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

      {activeTab === "graficos" && (
        <AdminQuestionsChartTab
          from={dateRange?.from ?? subDays(new Date(), 29)}
          to={dateRange?.to ?? dateRange?.from ?? new Date()}
          certificationCode={certificationCode || undefined}
        />
      )}

      {selectedQuestion && (
        <div className="fixed inset-0 z-50 grid place-items-center  bg-black/70 p-4">
          <div className="w-full max-w-4xl space-y-4 rounded border overflow-x-auto max-h-[90%] border-[#334155] bg-[#111827] p-4 text-[#e2e8f0]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[#f97316]">Detalhes da questao</p>
                <p className="mt-1 text-sm">{selectedQuestion.externalId}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleReportsPanel}
                  className="border border-[#854d0e] bg-amber-900/20 px-3 py-1 text-xs uppercase text-amber-200"
                >
                  {reportsPanelOpen ? "Ocultar denuncias" : "Mostrar denuncias"}
                  {typeof selectedQuestion.reportCount === "number" ? ` (${selectedQuestion.reportCount})` : ""}
                </button>
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

            {reportsPanelOpen && (
              <section className="space-y-3 rounded border border-[#7c2d12]/50 bg-[#0b1220] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs uppercase text-amber-300">Denuncias recebidas</p>
                  {reportsResult && (
                    <p className="text-xs text-[#cbd5e1]">
                      Pagina {reportsResult.page} de {reportsResult.totalPages} · Total {reportsResult.total}
                    </p>
                  )}
                </div>

                {reportsLoading && <p className="text-sm text-[#cbd5e1]">Carregando denuncias...</p>}
                {reportsError && <p className="text-sm text-[#fca5a5]">{reportsError}</p>}

                {!reportsLoading && !reportsError && reportsResult && (
                  <>
                    {reportsResult.items.length === 0 ? (
                      <p className="text-sm text-[#94a3b8]">Nenhuma denuncia encontrada para esta questao.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportsResult.items.map((report) => {
                          const reporterName = report.reporter.name?.trim() || report.reporter.username || "Usuario";
                          return (
                            <article
                              key={report.id}
                              className="space-y-2 rounded border border-[#334155] bg-[#111827] p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-start gap-2">
                                  <Avatar size="sm" className="mt-0.5 border border-[#334155]">
                                    {report.reporter.imageUrl ? (
                                      <AvatarImage src={report.reporter.imageUrl} alt={reporterName} />
                                    ) : null}
                                    <AvatarFallback>{toInitials(reporterName)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm text-[#e2e8f0]">{reporterName}</p>
                                    <p className="text-xs text-[#94a3b8]">
                                      {report.reporter.username ? `@${report.reporter.username} · ` : ""}
                                      {formatDate(report.reportedAt)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1">
                                  <span className="border border-[#f59e0b]/60 px-2 py-0.5 text-[10px] uppercase text-amber-300">
                                    {formatReportReason(report.reason)}
                                  </span>
                                  <span className="border border-[#334155] px-2 py-0.5 text-[10px] uppercase text-[#cbd5e1]">
                                    {formatReportStatus(report.status)}
                                  </span>
                                </div>
                              </div>

                              <p className="text-sm text-[#cbd5e1]">
                                {report.description?.trim() || "Sem descricao informada."}
                              </p>

                              {(report.status === "OPEN" || report.status === "IN_REVIEW") && (
                                <div className="flex flex-wrap justify-end gap-2 border-t border-[#1e293b] pt-2">
                                  <button
                                    type="button"
                                    disabled={Boolean(reportActionRunningId)}
                                    onClick={() => void moderateReportStatus(report.id, "RESOLVED")}
                                    className="border border-[#14532d] bg-green-900/20 px-2 py-1 text-[10px] uppercase text-green-200 disabled:opacity-60"
                                  >
                                    {reportActionRunningId === report.id ? "Atualizando..." : "Marcar resolvida"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={Boolean(reportActionRunningId)}
                                    onClick={() => void moderateReportStatus(report.id, "DISMISSED")}
                                    className="border border-[#7c2d12] bg-amber-900/20 px-2 py-1 text-[10px] uppercase text-amber-200 disabled:opacity-60"
                                  >
                                    {reportActionRunningId === report.id ? "Atualizando..." : "Marcar descartada"}
                                  </button>
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}

                    {reportsResult.totalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#1e293b] pt-2">
                        <button
                          type="button"
                          disabled={reportsResult.page <= 1}
                          onClick={() => setReportsPage((previous) => Math.max(1, previous - 1))}
                          className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={reportsResult.page >= reportsResult.totalPages}
                          onClick={() => setReportsPage((previous) => Math.min(reportsResult.totalPages, previous + 1))}
                          className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
                        >
                          Proxima
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

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
                    <strong>Servicos:</strong>{" "}
                    {(() => {
                      const serviceCodes = Array.from(
                        new Set([
                          ...(selectedQuestion.awsServices?.map((service) => service.code) ?? []),
                          ...(selectedQuestion.awsService?.code ? [selectedQuestion.awsService.code] : []),
                        ]),
                      );

                      return serviceCodes.length > 0 ? serviceCodes.join(", ") : "-";
                    })()}{" "}
                    | <strong>Certificacao:</strong> {selectedQuestion.certificationPreset?.code ?? "-"}
                  </p>
                </div>

                <div className="grid gap-2 text-sm">
                  <p className="font-mono text-xs uppercase text-[#94a3b8]">Alternativas</p>
                  {selectedQuestionOptions
                    .filter((option, index) => index < 4 || Boolean(option.content))
                    .map((option) => (
                      <p key={`view-option-${option.label}`}>
                        {option.label}) {option.content ?? "-"}
                      </p>
                    ))}
                  <p className="mt-1 font-mono text-xs uppercase text-[#22c55e]">
                    Gabarito:{" "}
                    {selectedQuestionOptions
                      .filter((option) => option.isCorrect)
                      .map((option) => option.label)
                      .join(", ") || selectedQuestion.correctOption}
                  </p>
                </div>

                <div className="grid gap-2 text-sm">
                  <p className="font-mono text-xs uppercase text-[#94a3b8]">Explicacoes</p>
                  {selectedQuestionOptions
                    .filter((option, index) => index < 4 || Boolean(option.content) || Boolean(option.explanation))
                    .map((option) => (
                      <p key={`view-explanation-${option.label}`}>
                        {option.label}) {option.explanation ?? "-"}
                      </p>
                    ))}
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

                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs uppercase text-[#94a3b8]">Servicos AWS vinculados</p>
                  <div className="flex items-center gap-2 p-2">
                    <label htmlFor="search_services">Pesquisar servico:</label>
                    <input
                      type="text"
                      id="search_services"
                      value={serviceSearch}
                      placeholder="Nome ou codigo"
                      className="w-full border border-[#334155] bg-[#0b1220] px-3 py-1 text-sm text-[#e2e8f0] outline-none"
                      onChange={(event) => setServiceSearch(event.target.value)}
                    />
                    {serviceSearch && (
                      <button
                        type="button"
                        onClick={() => setServiceSearch("")}
                        className="border border-[#334155] px-2 py-1 text-[10px] uppercase"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 overflow-auto rounded border border-[#334155] bg-[#0b1220] p-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      {filteredAwsServices.map((service) => (
                        <label key={`service-${service.code}`} className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.serviceCodes.includes(service.code)}
                            onChange={() => toggleServiceCode(service.code)}
                          />
                          <span>
                            {service.code} - {service.name}
                          </span>
                        </label>
                      ))}
                    </div>
                    {filteredAwsServices.length === 0 && (
                      <p className="p-2 text-xs text-[#94a3b8]">Nenhum servico encontrado para essa busca.</p>
                    )}
                  </div>
                  <p className="text-[10px] uppercase text-[#94a3b8]">
                    Selecione um ou mais servicos. {filteredAwsServices.length} resultado(s).
                  </p>
                </div>

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

      {newQuestionModalOpen && (
        <QuestionCreateModal
          certifications={certifications}
          defaultCertificationCode={certificationCode || undefined}
          allServices={allAwsServices}
          onClose={() => setNewQuestionModalOpen(false)}
          onCreated={(_q: CreatedQuestion) => {
            setNewQuestionModalOpen(false);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}

      {jsonImportModalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
          <div className="w-full max-w-3xl space-y-4 rounded border border-[#334155] bg-[#111827] p-5 text-[#e2e8f0]">
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase text-[#38bdf8]">Importar questoes via JSON</p>
              <p className="text-xs text-[#94a3b8]">
                Cole o JSON, clique em Preview para auditar, remova questoes indesejadas e importe.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#94a3b8]">Certificacao padrao (opcional)</span>
                <select
                  value={jsonImportDefaultCert}
                  onChange={(e) => setJsonImportDefaultCert(e.target.value)}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
                >
                  <option value="">-- sem padrao (use certificationCode em cada questao) --</option>
                  {certifications.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#94a3b8]">JSON das questoes</span>
                <textarea
                  rows={8}
                  value={jsonImportText}
                  onChange={(e) => {
                    setJsonImportText(e.target.value);
                    setJsonImportPreviewList([]);
                    setJsonImportError(null);
                    setJsonImportSuccess(null);
                  }}
                  placeholder={'[{ "statement": "...", "options": { "A": "...", "B": "..." }, "correctOption": "A", "difficulty": "medium" }]'}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0] outline-none"
                />
              </label>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setJsonImportGuideOpen((v) => !v)}
                className="flex items-center gap-1 text-xs uppercase text-[#94a3b8] hover:text-[#e2e8f0]"
              >
                <span>{jsonImportGuideOpen ? "▾" : "▸"}</span> Guia de formato
              </button>
              {jsonImportGuideOpen && (
                <div className="mt-2 space-y-2 border border-[#1e293b] bg-[#0b1220] p-3 font-mono text-xs text-[#94a3b8]">
                  <p className="text-[#38bdf8]">Formato esperado:</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">{`[
  {
    "statement": "Qual servico AWS e usado para...",   // obrigatorio
    "options": {                                        // obrigatorio, min 2
      "A": "Amazon S3",
      "B": "Amazon EC2",
      "C": "AWS Lambda",
      "D": "Amazon RDS"
    },
    "correctOption": "A",                              // single choice
    // OU correctOptions: ["A", "C"],                  // multi choice
    "difficulty": "medium",                            // easy | medium | hard
    "questionType": "single",                          // single | multi
    "topic": "Storage",                                // padrao: OUTROS
    "certificationCode": "SAA-C03",                    // sobreescreve padrao
    "awsServiceNames": ["Amazon S3", "Amazon EC2"],    // servicos (nome livre)
    "explanations": {                                  // opcional
      "A": "S3 e usado para...",
      "B": "EC2 nao e..."
    }
  }
]`}</pre>
                </div>
              )}
            </div>

            {jsonImportError && (
              <p className="rounded border border-red-900/40 bg-red-900/20 px-3 py-2 text-xs text-[#fca5a5]">
                {jsonImportError}
              </p>
            )}

            {jsonImportSuccess && (
              <p className="rounded border border-green-900/40 bg-green-900/20 px-3 py-2 text-xs text-green-200">
                {jsonImportSuccess}
              </p>
            )}

            {jsonImportPreviewList.length > 0 && (
              <div className="space-y-2 border border-[#1e3a5f] bg-blue-900/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#38bdf8]">
                    {jsonImportPreviewList.filter((i) => i.selected).length} de {jsonImportPreviewList.length} questoes selecionadas
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setJsonImportPreviewList((prev) => prev.map((i) => ({ ...i, selected: true })))}
                      className="text-xs text-[#94a3b8] hover:text-[#e2e8f0] underline"
                    >
                      Selecionar todas
                    </button>
                    <span className="text-[#334155]">|</span>
                    <button
                      type="button"
                      onClick={() => setJsonImportPreviewList((prev) => prev.map((i) => ({ ...i, selected: false })))}
                      className="text-xs text-[#94a3b8] hover:text-[#e2e8f0] underline"
                    >
                      Desmarcar todas
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                  {jsonImportPreviewList.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2 rounded border px-2 py-2 text-xs transition-colors ${
                        item.selected
                          ? "border-[#1e3a5f] bg-[#0d1f33]"
                          : "border-[#1e293b] bg-[#0b1220] opacity-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) =>
                          setJsonImportPreviewList((prev) =>
                            prev.map((i) => (i.id === item.id ? { ...i, selected: e.target.checked } : i)),
                          )
                        }
                        className="mt-0.5 shrink-0 accent-[#f97316]"
                      />
                      <span className="w-5 shrink-0 text-right text-[#475569]">{item.index}.</span>
                      <span className="flex-1 text-[#cbd5e1] leading-snug">{item.statement.slice(0, 160)}{item.statement.length > 160 ? "..." : ""}</span>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <div className="flex gap-1 flex-wrap justify-end">
                          <span className={`px-1 rounded text-[10px] font-mono ${item.difficulty === "easy" ? "bg-green-900/40 text-green-300" : item.difficulty === "hard" ? "bg-red-900/40 text-red-300" : "bg-yellow-900/40 text-yellow-300"}`}>
                            {item.difficulty}
                          </span>
                          <span className="px-1 rounded text-[10px] font-mono bg-purple-900/40 text-purple-300">
                            {item.questionType}
                          </span>
                          {item.certificationCode && (
                            <span className="px-1 rounded text-[10px] font-mono bg-teal-900/40 text-teal-300">
                              {item.certificationCode}
                            </span>
                          )}
                        </div>
                        {item.services.length > 0 && (
                          <div className="flex gap-1 flex-wrap justify-end">
                            {item.services.slice(0, 3).map((svc) => (
                              <span key={svc} className="px-1 rounded text-[10px] font-mono bg-[#1e293b] text-[#94a3b8]">
                                {svc}
                              </span>
                            ))}
                            {item.services.length > 3 && (
                              <span className="text-[10px] text-[#475569]">+{item.services.length - 3}</span>
                            )}
                          </div>
                        )}
                        {item.services.length === 0 && (
                          <span className="text-[10px] text-[#ef4444]">sem servicos</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setJsonImportPreviewList((prev) => prev.filter((i) => i.id !== item.id))
                        }
                        className="shrink-0 ml-1 text-[#475569] hover:text-[#fca5a5] text-sm leading-none"
                        title="Remover esta questao"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-[#1e293b] pt-3">
              <button
                type="button"
                onClick={() => {
                  setJsonImportModalOpen(false);
                  setJsonImportText("");
                  setJsonImportPreviewList([]);
                  setJsonImportError(null);
                  setJsonImportSuccess(null);
                }}
                className="border border-[#334155] px-3 py-2 text-xs uppercase"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={!jsonImportText.trim()}
                onClick={() => handleJsonImportPreview()}
                className="border border-[#1e3a5f] bg-blue-900/20 px-3 py-2 text-xs uppercase text-[#38bdf8] disabled:opacity-60"
              >
                Preview / Auditar
              </button>
              <button
                type="button"
                disabled={jsonImportLoading || jsonImportPreviewList.filter((i) => i.selected).length === 0}
                onClick={() => void handleJsonImportSave()}
                className="border border-[#14532d] bg-green-900/20 px-3 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
              >
                {jsonImportLoading
                  ? "Importando..."
                  : `Importar (${jsonImportPreviewList.filter((i) => i.selected).length}) questoes`}
              </button>
            </div>
          </div>
        </div>
      )}

      {aiFillModalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded border border-[#334155] bg-[#111827] p-4 text-[#e2e8f0]">
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase text-[#fbbf24]">Preencher faltantes com IA</p>
              <p className="text-sm text-[#cbd5e1]">
                Pendentes atuais: <strong>{aiFillStats?.pending ?? 0}</strong>
              </p>
              <p className="text-xs text-[#94a3b8]">
                Maximo por requisicao IA: {aiFillStats?.maxChunkSize ?? 10} | Maximo por execucao:{" "}
                {aiFillStats?.maxTotalPerRun ?? 200}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase text-[#94a3b8]">Quantidade para processar</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, aiFillStats?.pending ?? 1)}
                  value={aiFillTotalToProcess}
                  onChange={(event) => setAiFillTotalToProcess(event.target.value)}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs uppercase text-[#94a3b8]">Lote por requisicao IA (1-10)</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={aiFillChunkSize}
                  onChange={(event) => setAiFillChunkSize(event.target.value)}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs uppercase text-[#94a3b8]">Delay entre requisicoes IA (ms)</span>
                <input
                  type="number"
                  min={0}
                  value={aiFillDelayMs}
                  onChange={(event) => setAiFillDelayMs(event.target.value)}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                />
              </label>

              <label className="inline-flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={aiFillDryRun}
                  onChange={(event) => setAiFillDryRun(event.target.checked)}
                />
                <span className="text-xs uppercase text-[#94a3b8]">Dry-run (nao persistir alteracoes)</span>
              </label>
            </div>

            {aiFillStatsError && <p className="text-xs text-[#fca5a5]">{aiFillStatsError}</p>}

            <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-3">
              <button
                type="button"
                onClick={() => setAiFillModalOpen(false)}
                className="border border-[#334155] px-3 py-2 text-xs uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={aiFillRunning || (aiFillStats?.pending ?? 0) === 0}
                onClick={() => void submitAiFillModal()}
                className="border border-[#14532d] bg-green-900/20 px-3 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
              >
                {aiFillRunning ? "Processando..." : "Iniciar processamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicatesModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-3xl space-y-4 rounded border border-[#334155] bg-[#111827] p-4 text-[#e2e8f0] overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[#f97316]">Questoes Duplicadas</p>
                <p className="text-xs text-[#94a3b8]">
                  {duplicatesGroups.length} grupo(s) · metodo: {duplicatesMethod}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={bulkRunning || selectedDuplicateIds.length === 0}
                  onClick={() => void handleDeleteSelectedDuplicates()}
                  className="border border-[#7f1d1d] bg-red-900/20 px-3 py-1 text-xs uppercase text-red-200 disabled:opacity-60"
                >
                  {bulkRunning
                    ? "Removendo..."
                    : `Remover selecionadas (${selectedDuplicateIds.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicatesModalOpen(false);
                    setSelectedDuplicateIds([]);
                  }}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase"
                >
                  Fechar
                </button>
              </div>
            </div>

            {duplicatesError && <p className="text-sm text-[#fca5a5]">{duplicatesError}</p>}

            {duplicatesGroups.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">Nenhuma duplicata encontrada.</p>
            ) : (
              <div className="space-y-4">
                {duplicatesGroups.map((group, groupIndex) => (
                  <div
                    key={groupIndex}
                    className="rounded border border-[#1e293b] bg-[#0b1220] p-3 space-y-2"
                  >
                    <p className="font-mono text-[10px] uppercase text-[#94a3b8]">
                      Grupo {groupIndex + 1} · {group.ids.length} questoes
                      {group.certificationCode ? ` · ${group.certificationCode}` : ""}
                    </p>
                    {group.ids.map((id, i) => (
                      <label
                        key={id}
                        className="flex items-start gap-2 text-xs text-[#cbd5e1] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDuplicateIds.includes(id)}
                          onChange={() => toggleDuplicateId(id)}
                          className="mt-0.5 shrink-0"
                        />
                        <span>
                          <span className="font-mono text-[#64748b]">{group.externalIds[i]} </span>
                          {group.statements[i]}...
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
