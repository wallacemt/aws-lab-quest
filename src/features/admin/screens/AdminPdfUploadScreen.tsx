"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";

type CertificationOption = {
  id: string;
  code: string;
  name: string;
};

type ExtractionResponse = {
  jobId: string;
  uploadedFileId: string;
  fileName: string;
  characters: number;
  preview: string;
  extractedText: string;
  certification: {
    code: string;
    name: string;
  };
};

type IngestResponse = {
  jobId: string;
  certificationCode: string;
  generatedCount: number;
  savedCount: number;
};

type ExamGuideResponse = {
  uploadedFileId: string | null;
  fileName: string;
  characters: number;
  preview: string;
  message: string;
  certification: {
    code: string;
    name: string;
  };
};

type ApiErrorResponse = {
  error: string;
  conflict?: {
    certificationCode: string;
    certificationName: string;
    updatedAt: string;
  };
};

type UploadMode = "exam-guide" | "simulado" | "simulado-completo";

type IngestionJobResponse = {
  job: {
    id: string;
    status: "PENDING" | "UPLOADING" | "EXTRACTING" | "GENERATING" | "SAVING" | "COMPLETED" | "FAILED";
    uploadType: "EXAM_GUIDE" | "SIMULADO_PDF" | "SIMULADO_GENERATION";
    fileName: string | null;
    progressPercent: number;
    message: string | null;
    generatedCount: number | null;
    savedCount: number | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

type ExamGuideStatusItem = {
  id: string;
  code: string;
  name: string;
  hasExamGuide: boolean;
  updatedAt: string;
  latestUpload: {
    id: string;
    fileName: string;
    createdAt: string;
    uploadedBy: {
      name: string | null;
      email: string;
    } | null;
  } | null;
};

type UploadDashboardPayload = {
  files: Array<{
    id: string;
    uploadType: "EXAM_GUIDE" | "SIMULADO_PDF" | "SIMULADO_GENERATION";
    fileName: string;
    fileSizeBytes: number;
    createdAt: string;
    certificationPreset: {
      code: string;
      name: string;
    } | null;
    uploadedBy: {
      name: string | null;
      email: string;
    } | null;
  }>;
  recentJobs: Array<{
    id: string;
    status: "PENDING" | "UPLOADING" | "EXTRACTING" | "GENERATING" | "SAVING" | "COMPLETED" | "FAILED";
    uploadType: "EXAM_GUIDE" | "SIMULADO_PDF" | "SIMULADO_GENERATION";
    progressPercent: number;
    message: string | null;
    generatedCount: number | null;
    savedCount: number | null;
    errorMessage: string | null;
    createdAt: string;
    certificationPreset: {
      code: string;
      name: string;
    } | null;
  }>;
};

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

export function AdminPdfUploadScreen() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [mode, setMode] = useState<UploadMode>("exam-guide");
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
        const response = await fetch("/api/admin/uploads?limit=8", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as UploadDashboardPayload;
        setUploadDashboard(payload);
      } catch {
        // Preserve upload flow even if dashboard endpoint is unavailable.
      }
    }

    void loadGuideStatus();
    void loadUploadDashboard();
  }, []);

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
  }

  async function reloadAdminUploadData() {
    try {
      const [statusResponse, dashboardResponse] = await Promise.all([
        fetch("/api/admin/pdf/exam-guide/status", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        }),
        fetch("/api/admin/uploads?limit=8", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      if (statusResponse.ok) {
        const statusPayload = (await statusResponse.json()) as { certifications?: ExamGuideStatusItem[] };
        setGuideStatuses(statusPayload.certifications ?? []);
      }

      if (dashboardResponse.ok) {
        const dashboardPayload = (await dashboardResponse.json()) as UploadDashboardPayload;
        setUploadDashboard(dashboardPayload);
      }
    } catch {
      // Soft refresh only.
    }
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
    const response = await fetch("/api/admin/pdf/extract", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const payload = (await response.json()) as ExtractionResponse | { error: string };
    if (!response.ok || "error" in payload) {
      setError("error" in payload ? payload.error : "Falha ao processar PDF.");
      return;
    }

    setActiveJobId(payload.jobId);
    setSimuladoResult(payload);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetStatus();

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    const hasPdf = file instanceof File && file.size > 0;
    const manualText = manualExamGuideText.trim();

    if (mode === "simulado" && !hasPdf) {
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
        const extracted = await (async () => {
          const response = await fetch("/api/admin/pdf/extract", {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          const payload = (await response.json()) as ExtractionResponse | { error: string };
          if (!response.ok || "error" in payload) {
            setError("error" in payload ? payload.error : "Falha ao processar PDF.");
            return null;
          }

          return payload;
        })();

        if (!extracted) {
          return;
        }

        setActiveJobId(extracted.jobId);
        setSimuladoResult(extracted);

        setSaving(true);
        const response = await fetch("/api/admin/pdf/ingest", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            certificationCode: extracted.certification.code,
            extractedText: extracted.extractedText,
            desiredCount: 20,
            jobId: extracted.jobId,
            uploadedFileId: extracted.uploadedFileId,
          }),
        });

        const payload = (await response.json()) as IngestResponse | { error: string };
        if (!response.ok || "error" in payload) {
          setError("error" in payload ? payload.error : "Falha ao salvar questoes no banco.");
          return;
        }

        setActiveJobId(payload.jobId);
        setIngestResult(payload);
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

  async function handleIngest() {
    if (!simuladoResult) {
      return;
    }

    setSaving(true);
    setError(null);
    setIngestResult(null);

    try {
      const response = await fetch("/api/admin/pdf/ingest", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          certificationCode: simuladoResult.certification.code,
          extractedText: simuladoResult.extractedText,
          desiredCount: 20,
          jobId: simuladoResult.jobId,
          uploadedFileId: simuladoResult.uploadedFileId,
        }),
      });

      const payload = (await response.json()) as IngestResponse | { error: string };
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error : "Falha ao salvar questoes no banco.");
        return;
      }

      setIngestResult(payload);
      setActiveJobId(payload.jobId);
      await reloadAdminUploadData();
    } catch {
      setError("Erro inesperado ao salvar questoes geradas.");
    } finally {
      setSaving(false);
    }
  }

  const selectedGuideStatus = guideStatuses.find((guideStatus) => guideStatus.code === selectedCertificationCode);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <PixelCard className="space-y-3">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Admin OCR</p>
        <h1 className="font-mono text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
          Upload de documentos de certificacao
        </h1>
        <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
          Fluxo recomendado: primeiro enviar o Exam Guide oficial da certificacao e depois enviar PDFs de simulado.
        </p>
        <p className="font-[var(--font-body)] text-xs leading-6 text-[var(--pixel-subtext)]">
          Exemplo de guide: AWS-Certified-Cloud-Practitioner_Exam-Guide.pdf
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin">
            <PixelButton variant="ghost">Voltar</PixelButton>
          </Link>
          <Link href="/admin/questions">
            <PixelButton variant="ghost">Ver banco de questoes</PixelButton>
          </Link>
        </div>
      </PixelCard>

      <PixelCard className="space-y-3">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Tipo de upload</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("exam-guide");
              resetStatus();
            }}
            className={`border px-3 py-2 font-mono text-[10px] uppercase ${
              mode === "exam-guide"
                ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10"
                : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
            }`}
          >
            Exam Guide (obrigatorio)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("simulado");
              resetStatus();
            }}
            className={`border px-3 py-2 font-mono text-[10px] uppercase ${
              mode === "simulado"
                ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10"
                : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
            }`}
          >
            Simulado (2 etapas)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("simulado-completo");
              resetStatus();
            }}
            className={`border px-3 py-2 font-mono text-[10px] uppercase ${
              mode === "simulado-completo"
                ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10"
                : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
            }`}
          >
            Simulado Completo (1 clique)
          </button>
        </div>
      </PixelCard>

      {selectedGuideStatus && (
        <PixelCard className="space-y-2">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Status do Exam Guide</p>
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
            {selectedGuideStatus.code} - {selectedGuideStatus.name}:{" "}
            {selectedGuideStatus.hasExamGuide ? "ja possui guia salvo" : "sem guia salvo"}
          </p>
          {selectedGuideStatus.latestUpload && (
            <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
              Ultimo arquivo: {selectedGuideStatus.latestUpload.fileName} em{" "}
              {formatDate(selectedGuideStatus.latestUpload.createdAt)}
            </p>
          )}
        </PixelCard>
      )}

      <PixelCard>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Certificacao alvo</span>
            <select
              name="certificationCode"
              value={selectedCertificationCode}
              onChange={(event) => setSelectedCertificationCode(event.target.value)}
              className="w-full rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
              required
            >
              {certifications.length === 0 && <option value="">Carregando certificacoes...</option>}
              {certifications.map((certification) => (
                <option key={certification.id} value={certification.code}>
                  {certification.code} - {certification.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Arquivo PDF</span>
            <input
              type="file"
              name="file"
              accept="application/pdf,.pdf"
              className="w-full rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
            />
          </label>

          {mode === "exam-guide" && (
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                Fallback manual (para PDF escaneado)
              </span>
              <textarea
                value={manualExamGuideText}
                onChange={(event) => setManualExamGuideText(event.target.value)}
                placeholder="Cole aqui o texto do exam guide caso o PDF nao tenha texto selecionavel."
                className="min-h-[180px] w-full rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-3">
            <PixelButton type="submit" disabled={loading}>
              {loading
                ? "Processando..."
                : mode === "exam-guide"
                  ? "Salvar Exam Guide"
                  : mode === "simulado-completo"
                    ? "Extrair + Gerar + Salvar"
                    : "Extrair texto do simulado"}
            </PixelButton>

            {mode === "simulado" && simuladoResult && (
              <PixelButton type="button" disabled={saving} onClick={handleIngest}>
                {saving ? "Salvando questoes..." : "Gerar e salvar questoes"}
              </PixelButton>
            )}
          </div>

          {mode === "exam-guide" && selectedGuideStatus?.hasExamGuide && (
            <label className="flex items-center gap-2 text-xs text-[var(--pixel-subtext)]">
              <input
                type="checkbox"
                checked={overwriteExamGuide}
                onChange={(event) => setOverwriteExamGuide(event.target.checked)}
              />
              Confirmo que desejo sobrescrever o Exam Guide atual desta certificacao.
            </label>
          )}
        </form>
      </PixelCard>

      {jobSnapshot && (
        <PixelCard className="space-y-3">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Progresso do processamento</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Etapa: {jobSnapshot.status} | {jobSnapshot.message || "Processando..."}
          </p>
          <div className="h-3 w-full overflow-hidden rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
            <div
              className="h-full bg-[var(--pixel-primary)] transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, jobSnapshot.progressPercent))}%` }}
            />
          </div>
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
            {jobSnapshot.progressPercent}% concluido
          </p>
        </PixelCard>
      )}

      {error && (
        <PixelCard className="border-[var(--pixel-danger)] bg-[var(--pixel-danger)]/10">
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{error}</p>
        </PixelCard>
      )}

      {warning && (
        <PixelCard className="border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10">
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{warning}</p>
        </PixelCard>
      )}

      {simuladoResult && (
        <PixelCard className="space-y-3">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Preview extraido</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Arquivo: {simuladoResult.fileName} | Certificacao: {simuladoResult.certification.code} | Caracteres:{" "}
            {simuladoResult.characters}
          </p>
          <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-xs leading-5 text-[var(--pixel-text)]">
            {simuladoResult.preview}
          </pre>
        </PixelCard>
      )}

      {examGuideResult && (
        <PixelCard className="space-y-3 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Exam Guide atualizado</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            {examGuideResult.message} | Certificacao: {examGuideResult.certification.code} | Caracteres:{" "}
            {examGuideResult.characters}
          </p>
          <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-xs leading-5 text-[var(--pixel-text)]">
            {examGuideResult.preview}
          </pre>
        </PixelCard>
      )}

      {ingestResult && (
        <PixelCard className="space-y-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Ingestao concluida</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Certificacao: {ingestResult.certificationCode} | Geradas: {ingestResult.generatedCount} | Salvas:{" "}
            {ingestResult.savedCount}
          </p>
        </PixelCard>
      )}

      {uploadDashboard && (
        <PixelCard className="space-y-4">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
            Arquivos enviados e jobs recentes
          </p>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Arquivos</p>
            {uploadDashboard.files.length === 0 ? (
              <p className="text-sm text-[var(--pixel-subtext)]">Nenhum arquivo registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {uploadDashboard.files.map((fileItem) => (
                  <div key={fileItem.id} className="rounded border border-[var(--pixel-border)] p-2 text-xs">
                    <p className="font-mono uppercase text-[var(--pixel-text)]">
                      {fileItem.uploadType} | {fileItem.fileName}
                    </p>
                    <p className="text-[var(--pixel-subtext)]">
                      {fileItem.certificationPreset?.code ?? "SEM-CERT"} | {formatBytes(fileItem.fileSizeBytes)} |{" "}
                      {formatDate(fileItem.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Jobs</p>
            {uploadDashboard.recentJobs.length === 0 ? (
              <p className="text-sm text-[var(--pixel-subtext)]">Nenhum job registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {uploadDashboard.recentJobs.map((jobItem) => (
                  <div key={jobItem.id} className="rounded border border-[var(--pixel-border)] p-2 text-xs">
                    <p className="font-mono uppercase text-[var(--pixel-text)]">
                      {jobItem.uploadType} | {jobItem.status} | {jobItem.progressPercent}%
                    </p>
                    <p className="text-[var(--pixel-subtext)]">
                      {jobItem.certificationPreset?.code ?? "SEM-CERT"} | {formatDate(jobItem.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PixelCard>
      )}
    </main>
  );
}
