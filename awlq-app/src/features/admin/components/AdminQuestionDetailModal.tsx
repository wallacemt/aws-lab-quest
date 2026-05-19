"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  deleteAdminQuestion,
  getAdminQuestion,
  listAdminQuestionReports,
  updateAdminQuestion,
  updateAdminQuestionReportStatus,
} from "@/features/admin/services/admin-api";
import {
  AdminQuestionListItem,
  AdminQuestionReportListItem,
  PaginatedResult,
} from "@/features/admin/types";
import { ServiceMultiSelect, ServiceOption as AwsServiceOption } from "@/features/admin/components/ServiceMultiSelect";

type Props = {
  questionId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

function formatReportReason(value: AdminQuestionReportListItem["reason"]): string {
  switch (value) {
    case "INCORRECT_ANSWER": return "Resposta incorreta";
    case "UNCLEAR_STATEMENT": return "Enunciado confuso";
    case "MISSING_CONTEXT": return "Falta de contexto";
    case "GRAMMAR_TYPO": return "Gramatica / typo";
    case "DUPLICATE": return "Questao duplicada";
    case "QUALITY_ISSUE": return "Problema de qualidade";
    default: return "Outro";
  }
}

function formatReportStatus(value: AdminQuestionReportListItem["status"]): string {
  switch (value) {
    case "OPEN": return "Aberta";
    case "IN_REVIEW": return "Em revisao";
    case "RESOLVED": return "Resolvida";
    default: return "Descartada";
  }
}

function toInitials(name: string): string {
  const parts = name.split(" ").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}


function resolveQuestionOptions(question: AdminQuestionListItem) {
  const labels = ["A", "B", "C", "D", "E"] as const;
  const legacyCorrect = question.correctOptions ?? [question.correctOption];
  return labels.map((label) => {
    const fromPayload = question.options?.find((item) => item.label === label);
    const content =
      fromPayload?.content ??
      (label === "A" ? question.optionA : label === "B" ? question.optionB : label === "C" ? question.optionC : label === "D" ? question.optionD : question.optionE);
    const explanation =
      fromPayload?.explanation ??
      (label === "A" ? question.explanationA : label === "B" ? question.explanationB : label === "C" ? question.explanationC : label === "D" ? question.explanationD : question.explanationE);
    return { label, content, explanation, isCorrect: fromPayload?.isCorrect ?? legacyCorrect.includes(label) };
  });
}

type EditForm = {
  statement: string; topic: string; difficulty: "easy" | "medium" | "hard";
  questionType: "single" | "multi"; usage: "KC" | "SIMULADO" | "BOTH"; active: boolean;
  optionA: string; optionB: string; optionC: string; optionD: string; optionE: string;
  correctOption: string; correctOptions: string;
  explanationA: string; explanationB: string; explanationC: string; explanationD: string; explanationE: string;
  serviceCodes: string[];
};

const BLANK_FORM: EditForm = {
  statement: "", topic: "", difficulty: "easy", questionType: "single", usage: "BOTH", active: true,
  optionA: "", optionB: "", optionC: "", optionD: "", optionE: "",
  correctOption: "A", correctOptions: "A",
  explanationA: "", explanationB: "", explanationC: "", explanationD: "", explanationE: "",
  serviceCodes: [],
};

function buildEditForm(q: AdminQuestionListItem): EditForm {
  const opts = resolveQuestionOptions(q);
  const byLabel = Object.fromEntries(opts.map((o) => [o.label, o])) as Record<"A" | "B" | "C" | "D" | "E", (typeof opts)[number]>;
  const computedCorrectOptions = opts.filter((o) => o.isCorrect).map((o) => o.label);
  const serviceCodes = Array.from(new Set([
    ...(q.awsServices?.map((s) => s.code) ?? []),
    ...(q.awsService?.code ? [q.awsService.code] : []),
  ]));
  return {
    statement: q.statement,
    topic: q.topic,
    difficulty: q.difficulty,
    questionType: q.questionType,
    usage: q.usage,
    active: q.active,
    optionA: byLabel.A?.content ?? q.optionA,
    optionB: byLabel.B?.content ?? q.optionB,
    optionC: byLabel.C?.content ?? q.optionC,
    optionD: byLabel.D?.content ?? q.optionD,
    optionE: byLabel.E?.content ?? q.optionE ?? "",
    correctOption: computedCorrectOptions[0] ?? q.correctOption,
    correctOptions: computedCorrectOptions.join(",") || q.correctOption,
    explanationA: byLabel.A?.explanation ?? q.explanationA ?? "",
    explanationB: byLabel.B?.explanation ?? q.explanationB ?? "",
    explanationC: byLabel.C?.explanation ?? q.explanationC ?? "",
    explanationD: byLabel.D?.explanation ?? q.explanationD ?? "",
    explanationE: byLabel.E?.explanation ?? q.explanationE ?? "",
    serviceCodes,
  };
}

export function AdminQuestionDetailModal({ questionId, onClose, onDeleted }: Props) {
  const [question, setQuestion] = useState<AdminQuestionListItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [reportsPanelOpen, setReportsPanelOpen] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsResult, setReportsResult] = useState<PaginatedResult<AdminQuestionReportListItem> | null>(null);
  const [reportActionRunningId, setReportActionRunningId] = useState<string | null>(null);
  const [allAwsServices, setAllAwsServices] = useState<AwsServiceOption[]>([]);

  const questionOptions = useMemo(() => (question ? resolveQuestionOptions(question) : []), [question]);

  useEffect(() => {
    if (!questionId) {
      setQuestion(null);
      setEditMode(false);
      setModalError(null);
      setLoadError(null);
      setReportsPanelOpen(false);
      setReportsPage(1);
      setReportsResult(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setEditMode(false);
    setModalError(null);
    getAdminQuestion(questionId)
      .then((q) => { setQuestion(q); setEditForm(buildEditForm(q)); })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Falha ao carregar questao."))
      .finally(() => setLoading(false));
  }, [questionId]);

  useEffect(() => {
    fetch("/api/study/services", { cache: "no-store", credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { services?: AwsServiceOption[] } | null) => { if (data?.services) setAllAwsServices(data.services); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!reportsPanelOpen || !question) return;
    setReportsLoading(true);
    setReportsError(null);
    listAdminQuestionReports(question.id, { page: reportsPage, pageSize: 5 })
      .then((r) => setReportsResult(r))
      .catch((err) => setReportsError(err instanceof Error ? err.message : "Falha ao carregar denuncias."))
      .finally(() => setReportsLoading(false));
  }, [reportsPanelOpen, question, reportsPage]);

  async function handleSave() {
    if (!question) return;
    setSaving(true);
    setModalError(null);
    try {
      const correctOptionsList = editForm.correctOptions
        .split(",")
        .map((v) => v.trim().toUpperCase())
        .filter((v) => ["A", "B", "C", "D", "E"].includes(v));
      const updated = await updateAdminQuestion(question.id, {
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
        correctOption: editForm.correctOption.toUpperCase(),
        correctOptions: correctOptionsList.length > 0 ? correctOptionsList : [editForm.correctOption.toUpperCase()],
        explanationA: editForm.explanationA || null,
        explanationB: editForm.explanationB || null,
        explanationC: editForm.explanationC || null,
        explanationD: editForm.explanationD || null,
        explanationE: editForm.explanationE || null,
        serviceCodes: editForm.serviceCodes,
      });
      setQuestion(updated);
      setEditForm(buildEditForm(updated));
      setEditMode(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Falha ao salvar questao.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!question) return;
    if (!window.confirm("Deseja remover esta questao permanentemente?")) return;
    setDeleting(true);
    setModalError(null);
    try {
      await deleteAdminQuestion(question.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Falha ao remover questao.");
    } finally {
      setDeleting(false);
    }
  }

  async function moderateReport(reportId: string, status: "RESOLVED" | "DISMISSED") {
    if (!question) return;
    setReportActionRunningId(reportId);
    try {
      await updateAdminQuestionReportStatus(question.id, reportId, { status });
      setReportsPage(1);
      setReportsResult(null);
      listAdminQuestionReports(question.id, { page: 1, pageSize: 5 })
        .then((r) => setReportsResult(r))
        .catch(() => undefined);
    } catch {
      // ignore
    } finally {
      setReportActionRunningId(null);
    }
  }


  if (!questionId) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-4xl space-y-4 rounded border overflow-x-auto max-h-[90%] border-[#334155] bg-[#111827] p-4 text-[#e2e8f0]">
        {loading && <p className="text-sm text-[#94a3b8]">Carregando questao...</p>}
        {loadError && <p className="text-sm text-[#fca5a5]">{loadError}</p>}

        {!loading && !loadError && question && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[#f97316]">Detalhes da questao</p>
                <p className="mt-1 text-sm">{question.externalId}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setReportsPanelOpen((prev) => !prev); if (!reportsPanelOpen) setReportsPage(1); }}
                  className="border border-[#854d0e] bg-amber-900/20 px-3 py-1 text-xs uppercase text-amber-200"
                >
                  {reportsPanelOpen ? "Ocultar denuncias" : "Mostrar denuncias"}
                  {typeof question.reportCount === "number" ? ` (${question.reportCount})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode((prev) => !prev)}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase"
                >
                  {editMode ? "Modo leitura" : "Editar"}
                </button>
                <button type="button" onClick={onClose} className="border border-[#334155] px-3 py-1 text-xs uppercase">
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
                            <article key={report.id} className="space-y-2 rounded border border-[#334155] bg-[#111827] p-3">
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
                              <p className="text-sm text-[#cbd5e1]">{report.description?.trim() || "Sem descricao informada."}</p>
                              {(report.status === "OPEN" || report.status === "IN_REVIEW") && (
                                <div className="flex flex-wrap justify-end gap-2 border-t border-[#1e293b] pt-2">
                                  <button
                                    type="button"
                                    disabled={Boolean(reportActionRunningId)}
                                    onClick={() => void moderateReport(report.id, "RESOLVED")}
                                    className="border border-[#14532d] bg-green-900/20 px-2 py-1 text-[10px] uppercase text-green-200 disabled:opacity-60"
                                  >
                                    {reportActionRunningId === report.id ? "Atualizando..." : "Marcar resolvida"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={Boolean(reportActionRunningId)}
                                    onClick={() => void moderateReport(report.id, "DISMISSED")}
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
                          onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                          className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={reportsResult.page >= reportsResult.totalPages}
                          onClick={() => setReportsPage((p) => Math.min(reportsResult.totalPages, p + 1))}
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
                  <p><strong>Enunciado:</strong> {question.statement}</p>
                  <p><strong>Topico:</strong> {question.topic}</p>
                  <p><strong>Dificuldade:</strong> {question.difficulty.toUpperCase()} | <strong>Uso:</strong> {question.usage}</p>
                  <p><strong>Tipo:</strong> {question.questionType.toUpperCase()} | <strong>Status:</strong> {question.active ? "ATIVA" : "INATIVA"}</p>
                  <p>
                    <strong>Servicos:</strong>{" "}
                    {(() => {
                      const codes = Array.from(new Set([
                        ...(question.awsServices?.map((s) => s.code) ?? []),
                        ...(question.awsService?.code ? [question.awsService.code] : []),
                      ]));
                      return codes.length > 0 ? codes.join(", ") : "-";
                    })()}{" "}
                    | <strong>Certificacao:</strong> {question.certificationPreset?.code ?? "-"}
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <p className="font-mono text-xs uppercase text-[#94a3b8]">Alternativas</p>
                  {questionOptions.filter((o, i) => i < 4 || Boolean(o.content)).map((o) => (
                    <p key={`view-opt-${o.label}`}>{o.label}) {o.content ?? "-"}</p>
                  ))}
                  <p className="mt-1 font-mono text-xs uppercase text-[#22c55e]">
                    Gabarito: {questionOptions.filter((o) => o.isCorrect).map((o) => o.label).join(", ") || question.correctOption}
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <p className="font-mono text-xs uppercase text-[#94a3b8]">Explicacoes</p>
                  {questionOptions.filter((o, i) => i < 4 || Boolean(o.content) || Boolean(o.explanation)).map((o) => (
                    <p key={`view-exp-${o.label}`}>{o.label}) {o.explanation ?? "-"}</p>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs uppercase text-[#94a3b8]">Enunciado</span>
                  <textarea
                    value={editForm.statement}
                    onChange={(e) => setEditForm((p) => ({ ...p, statement: e.target.value }))}
                    className="min-h-[110px] w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Topico</span>
                  <input
                    value={editForm.topic}
                    onChange={(e) => setEditForm((p) => ({ ...p, topic: e.target.value }))}
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Uso</span>
                  <select
                    value={editForm.usage}
                    onChange={(e) => setEditForm((p) => ({ ...p, usage: e.target.value as "KC" | "SIMULADO" | "BOTH" }))}
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
                    onChange={(e) => setEditForm((p) => ({ ...p, difficulty: e.target.value as "easy" | "medium" | "hard" }))}
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
                    onChange={(e) => setEditForm((p) => ({ ...p, questionType: e.target.value as "single" | "multi" }))}
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
                    onChange={(e) => setEditForm((p) => ({ ...p, active: e.target.checked }))}
                  />
                  <span className="text-xs uppercase text-[#94a3b8]">Questao ativa</span>
                </label>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs uppercase text-[#94a3b8]">Serviços AWS vinculados</p>
                  <ServiceMultiSelect
                    allServices={allAwsServices}
                    selectedCodes={editForm.serviceCodes}
                    onChange={(codes) => setEditForm((prev) => ({ ...prev, serviceCodes: codes }))}
                  />
                </div>

                {(["A", "B", "C", "D", "E"] as const).map((letter) => (
                  <label key={letter} className="space-y-1 md:col-span-2">
                    <span className="text-xs uppercase text-[#94a3b8]">Alternativa {letter}</span>
                    <input
                      value={letter === "A" ? editForm.optionA : letter === "B" ? editForm.optionB : letter === "C" ? editForm.optionC : letter === "D" ? editForm.optionD : editForm.optionE}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm((p) => ({
                          ...p,
                          ...(letter === "A" ? { optionA: val } : letter === "B" ? { optionB: val } : letter === "C" ? { optionC: val } : letter === "D" ? { optionD: val } : { optionE: val }),
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
                    onChange={(e) => setEditForm((p) => ({ ...p, correctOption: e.target.value.toUpperCase() }))}
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm uppercase"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-[#94a3b8]">Respostas corretas (A,B)</span>
                  <input
                    value={editForm.correctOptions}
                    onChange={(e) => setEditForm((p) => ({ ...p, correctOptions: e.target.value }))}
                    className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm uppercase"
                  />
                </label>

                {(["A", "B", "C", "D", "E"] as const).map((letter) => (
                  <label key={`exp-${letter}`} className="space-y-1 md:col-span-2">
                    <span className="text-xs uppercase text-[#94a3b8]">Explicacao {letter}</span>
                    <textarea
                      value={letter === "A" ? editForm.explanationA : letter === "B" ? editForm.explanationB : letter === "C" ? editForm.explanationC : letter === "D" ? editForm.explanationD : editForm.explanationE}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm((p) => ({
                          ...p,
                          ...(letter === "A" ? { explanationA: val } : letter === "B" ? { explanationB: val } : letter === "C" ? { explanationC: val } : letter === "D" ? { explanationD: val } : { explanationE: val }),
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
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="border border-[#14532d] bg-green-900/20 px-3 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar alteracoes"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="border border-[#7f1d1d] bg-red-900/20 px-3 py-2 text-xs uppercase text-red-200 disabled:opacity-60"
              >
                {deleting ? "Removendo..." : "Remover questao"}
              </button>
            </div>
          </>
        )}

        {!loading && !loadError && !question && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#94a3b8]">Questao nao encontrada.</p>
            <button type="button" onClick={onClose} className="border border-[#334155] px-3 py-1 text-xs uppercase">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
