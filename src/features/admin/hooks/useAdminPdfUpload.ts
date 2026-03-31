"use client";
import { useEffect, useRef, useState } from "react";
import {
  cancelAdminIngestionJob,
  listAdminUploadQuestions,
  listAdminUploads,
} from "@/features/admin/services/admin-api";
import {
  AdminUploadQuestionsPayload,
  ApiErrorResponse,
  CertificationOption,
  ExamGuideResponse,
  ExamGuideStatusItem,
  ExtractionResponse,
  IngestionJobResponse,
  IngestResponse,
  SimuladoQueueItem,
  UploadAction,
  UploadDashboardPayload,
  UploadMode,
} from "@/features/admin/types";
import { formatDate, inferQuestionCountFromText } from "../utils";

export const useAdminPdfUpload = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [mode, setMode] = useState<UploadMode>("simulado-completo");
  const [showUploadActions, setShowUploadActions] = useState(false);
  const [showFlowHelp, setShowFlowHelp] = useState(false);
  const [simuladoResult, setSimuladoResult] = useState<ExtractionResponse | null>(null);
  const [examGuideResult, setExamGuideResult] = useState<ExamGuideResponse | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null);
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [selectedCertificationCode, setSelectedCertificationCode] = useState("");
  const [manualExamGuideText, setManualExamGuideText] = useState("");
  const [overwriteExamGuide, setOverwriteExamGuide] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobSnapshot, setJobSnapshot] = useState<IngestionJobResponse["job"] | null>(null);
  const [guideStatuses, setGuideStatuses] = useState<ExamGuideStatusItem[]>([]);
  const [uploadDashboard, setUploadDashboard] = useState<UploadDashboardPayload | null>(null);
  const [auditFileId, setAuditFileId] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPayload, setAuditPayload] = useState<AdminUploadQuestionsPayload | null>(null);
  const [simuladoQueue, setSimuladoQueue] = useState<SimuladoQueueItem[]>([]);
  const [cancelRequested, setCancelRequested] = useState(false);
  const queueCancelRef = useRef(false);

  useEffect(() => {
    async function loadCertifications() {
      try {
        const response = await fetch("/api/certifications", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { certifications?: CertificationOption[] };
        const options = payload.certifications ?? [];
        setCertifications(options);

        if (options.length > 0) {
          setSelectedCertificationCode(options[0].code);
        }
      } catch {
        // Keep UI usable even if presets fail to load.
      }
    }

    void loadCertifications();
  }, []);

  useEffect(() => {
    async function loadGuideStatus() {
      try {
        const response = await fetch("/api/admin/pdf/exam-guide/status", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { certifications?: ExamGuideStatusItem[] };
        setGuideStatuses(payload.certifications ?? []);
      } catch {
        // Preserve upload flow even if status endpoint is unavailable.
      }
    }

    async function loadUploadDashboard() {
      try {
        const payload = await listAdminUploads({
          page: 1,
          pageSize: 8,
          limit: 8,
        });
        setUploadDashboard(payload);
      } catch {
        // Preserve upload flow even if dashboard endpoint is unavailable.
      }
    }

    void loadGuideStatus();
    void loadUploadDashboard();
  }, []);

  useEffect(() => {
    if (!auditFileId) {
      return;
    }

    let cancelled = false;

    async function loadAudit() {
      setAuditLoading(true);
      setAuditError(null);

      try {
        const payload = await listAdminUploadQuestions(auditFileId as string, {
          page: auditPage,
          pageSize: 8,
        });

        if (!cancelled) {
          setAuditPayload(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setAuditError(err instanceof Error ? err.message : "Falha ao carregar auditoria do documento.");
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    }

    void loadAudit();

    return () => {
      cancelled = true;
    };
  }, [auditFileId, auditPage]);

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    let cancelled = false;

    async function pollJob() {
      try {
        const response = await fetch(`/api/admin/uploads/jobs/${activeJobId}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as IngestionJobResponse;
        if (cancelled) {
          return;
        }

        setJobSnapshot(payload.job);

        if (payload.job.status === "COMPLETED" || payload.job.status === "FAILED") {
          setActiveJobId(null);
        }
      } catch {
        // Keep polling silently.
      }
    }

    const intervalId = window.setInterval(() => {
      void pollJob();
    }, 1500);

    void pollJob();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeJobId]);

  function resetStatus() {
    setError(null);
    setWarning(null);
    setSimuladoResult(null);
    setExamGuideResult(null);
    setIngestResult(null);
    setJobSnapshot(null);
    setOverwriteExamGuide(false);
    setSimuladoQueue([]);
    setCancelRequested(false);
    queueCancelRef.current = false;
  }

  async function handleCancelActiveProcessing() {
    const targetJobId = activeJobId ?? jobSnapshot?.id ?? null;
    if (!targetJobId) {
      return;
    }

    setCancelRequested(true);
    queueCancelRef.current = true;

    try {
      await cancelAdminIngestionJob(targetJobId);
      setWarning("Cancelamento solicitado. O processamento sera interrompido na proxima etapa segura.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel cancelar o processamento.");
      setCancelRequested(false);
      queueCancelRef.current = false;
    }
  }

  async function reloadAdminUploadData() {
    try {
      const [statusResponse, dashboardResponse] = await Promise.all([
        fetch("/api/admin/pdf/exam-guide/status", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        }),
        listAdminUploads({ page: 1, pageSize: 8, limit: 8 }),
      ]);

      if (statusResponse.ok) {
        const statusPayload = (await statusResponse.json()) as { certifications?: ExamGuideStatusItem[] };
        setGuideStatuses(statusPayload.certifications ?? []);
      }

      setUploadDashboard(dashboardResponse);
    } catch {
      // Soft refresh only.
    }
  }

  function startAction(nextAction: UploadAction) {
    setMode(nextAction);
    setShowUploadActions(false);
    setError(null);
    setWarning(null);
  }

  function closeAudit() {
    setAuditFileId(null);
    setAuditPayload(null);
    setAuditPage(1);
    setAuditError(null);
  }

  function updateQueueItem(id: string, next: Partial<SimuladoQueueItem>) {
    setSimuladoQueue((previous) => previous.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }

  async function requestSimuladoExtract(formData: FormData): Promise<ExtractionResponse> {
    const response = await fetch("/api/admin/pdf/extract", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const payload = (await response.json()) as ExtractionResponse | { error: string };
    if (!response.ok || "error" in payload) {
      throw new Error("error" in payload ? payload.error : "Falha ao processar PDF.");
    }

    return payload;
  }

  async function requestSimuladoIngest(input: {
    certificationCode: string;
    extractedText: string;
    ingestMode: "extract-existing" | "generate-new";
    jobId: string;
    uploadedFileId: string;
    desiredCount?: number;
  }): Promise<IngestResponse> {
    const response = await fetch("/api/admin/pdf/ingest", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as IngestResponse | { error: string };
    if (!response.ok || "error" in payload) {
      throw new Error("error" in payload ? payload.error : "Falha ao salvar questoes no banco.");
    }

    return payload;
  }

  async function uploadExamGuide(formData: FormData) {
    const response = await fetch("/api/admin/pdf/exam-guide", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const payload = (await response.json()) as ExamGuideResponse | ApiErrorResponse;
    if (!response.ok || "error" in payload) {
      if (response.status === 409 && payload.conflict) {
        setWarning(
          `Ja existe guia para ${payload.conflict.certificationCode}. Marque a confirmacao para sobrescrever. Ultima atualizacao: ${formatDate(payload.conflict.updatedAt)}.`,
        );
      }

      setError("error" in payload ? payload.error : "Falha ao salvar Exam Guide.");
      return;
    }

    setExamGuideResult(payload);
    await reloadAdminUploadData();
  }

  async function extractSimuladoPdf(formData: FormData) {
    try {
      const payload = await requestSimuladoExtract(formData);
      setActiveJobId(payload.jobId);
      setSimuladoResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar PDF.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetStatus();

    const formData = new FormData(event.currentTarget);
    const files = formData.getAll("file").filter((value): value is File => value instanceof File && value.size > 0);
    const firstFile = files[0] ?? null;
    const hasPdf = Boolean(firstFile);
    const manualText = manualExamGuideText.trim();

    if (mode === "simulado" && files.length > 1) {
      setError("No modo 2 etapas, envie apenas um PDF por vez.");
      return;
    }

    if ((mode === "simulado" || mode === "simulado-completo") && !hasPdf) {
      setError("Selecione um PDF antes de continuar.");
      return;
    }

    if (mode === "exam-guide" && !hasPdf && manualText.length === 0) {
      setError("Envie um PDF ou cole o texto manual do Exam Guide.");
      return;
    }

    if (!selectedCertificationCode) {
      setError("Selecione a certificacao alvo para continuar.");
      return;
    }

    formData.set("certificationCode", selectedCertificationCode);
    if (mode === "exam-guide") {
      formData.set("manualText", manualText);
      formData.set("overwriteConfirmed", overwriteExamGuide ? "true" : "false");
    }

    setLoading(true);

    try {
      if (mode === "exam-guide") {
        await uploadExamGuide(formData);
      } else if (mode === "simulado-completo") {
        setCancelRequested(false);
        queueCancelRef.current = false;

        const initialQueue = files.map((file, index) => ({
          id: `${Date.now()}-${index}`,
          fileName: file.name,
          status: "PENDING" as const,
        }));
        setSimuladoQueue(initialQueue);

        let completed = 0;
        let failed = 0;

        for (let index = 0; index < files.length; index += 1) {
          if (queueCancelRef.current) {
            break;
          }

          const file = files[index];
          const queueItem = initialQueue[index];

          try {
            updateQueueItem(queueItem.id, { status: "EXTRACTING" });

            const singleFileFormData = new FormData();
            singleFileFormData.set("file", file);
            singleFileFormData.set("certificationCode", selectedCertificationCode);

            const extracted = await requestSimuladoExtract(singleFileFormData);
            setActiveJobId(extracted.jobId);
            setSimuladoResult(extracted);

            if (queueCancelRef.current) {
              await cancelAdminIngestionJob(extracted.jobId).catch(() => undefined);
              updateQueueItem(queueItem.id, {
                status: "FAILED",
                error: "Processamento cancelado manualmente.",
              });
              break;
            }

            updateQueueItem(queueItem.id, { status: "INGESTING" });
            const ingestPayload = await requestSimuladoIngest({
              certificationCode: extracted.certification.code,
              extractedText: extracted.extractedText,
              ingestMode: "extract-existing",
              jobId: extracted.jobId,
              uploadedFileId: extracted.uploadedFileId,
            });

            completed += 1;
            setIngestResult(ingestPayload);
            setActiveJobId(ingestPayload.jobId);
            updateQueueItem(queueItem.id, {
              status: "COMPLETED",
              generatedCount: ingestPayload.generatedCount,
              savedCount: ingestPayload.savedCount,
              rejectedCount: ingestPayload.rejectedCount,
            });
          } catch (err) {
            failed += 1;
            updateQueueItem(queueItem.id, {
              status: "FAILED",
              error: err instanceof Error ? err.message : "Falha no processamento do arquivo.",
            });
          }
        }

        if (queueCancelRef.current) {
          setWarning("Fila interrompida por cancelamento manual.");
        } else if (failed > 0) {
          setError(`Fila finalizada com falhas: ${failed} arquivo(s) com erro e ${completed} concluido(s).`);
        }

        await reloadAdminUploadData();
      } else {
        await extractSimuladoPdf(formData);
      }
    } catch {
      setError("Erro inesperado ao enviar PDF.");
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }

  async function handleIngest(ingestMode: "extract-existing" | "generate-new") {
    if (!simuladoResult) {
      return;
    }

    setSaving(true);
    setError(null);
    setIngestResult(null);

    try {
      const inferredQuestionCount = inferQuestionCountFromText(simuladoResult.extractedText);
      const desiredCount =
        ingestMode === "generate-new"
          ? Math.max(10, Math.min(80, inferredQuestionCount > 0 ? inferredQuestionCount : 20))
          : undefined;

      const payload = await requestSimuladoIngest({
        certificationCode: simuladoResult.certification.code,
        extractedText: simuladoResult.extractedText,
        desiredCount,
        ingestMode,
        jobId: simuladoResult.jobId,
        uploadedFileId: simuladoResult.uploadedFileId,
      });

      setIngestResult(payload);
      setActiveJobId(payload.jobId);
      await reloadAdminUploadData();
    } catch {
      setError("Erro inesperado ao salvar questoes geradas.");
    } finally {
      setSaving(false);
    }
  }

  return {
    guideStatuses,
    simuladoResult,
    selectedCertificationCode,
    reloadAdminUploadData,
    setSelectedCertificationCode,
    resetStatus,
    certifications,
    startAction,
    setShowFlowHelp,
    showUploadActions,
    setShowUploadActions,
    handleCancelActiveProcessing,
    handleSubmit,
    mode,
    setManualExamGuideText,
    manualExamGuideText,
    loading,
    saving,
    handleIngest,
    activeJobId,
    cancelRequested,
    overwriteExamGuide,
    setOverwriteExamGuide,
    jobSnapshot,
    simuladoQueue,
    error,
    warning,
    ingestResult,
    examGuideResult,
    uploadDashboard,
    setAuditFileId,
    auditFileId,
    setAuditPage,
    auditPayload,
    auditLoading,
    auditError,
    closeAudit,
    showFlowHelp,
  };
};
