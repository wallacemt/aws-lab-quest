"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QuestionCreateModal, CreatedQuestion } from "@/features/admin/components/QuestionCreateModal";
import { ArtworkUploadField } from "@/features/admin/components/ArtworkUploadField";
import { CertificationOption } from "@/features/admin/types";

type AvailableQuestion = {
  id: string;
  statement: string;
  topic: string | null;
  difficulty: string;
  questionType: string;
  createdAt: string;
};

type AvailableQuestionsPayload = {
  items: AvailableQuestion[];
  total: number;
  page: number;
  pageSize: number;
};

export function AdminSimuladoMakerScreen() {
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [name, setName] = useState("");
  const [certificationCode, setCertificationCode] = useState("");
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);

  // Step 2 — question picker
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsData, setQuestionsData] = useState<AvailableQuestionsPayload | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedQuestions, setSelectedQuestions] = useState<AvailableQuestion[]>([]);

  // Step 3 — confirm + submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdPack, setCreatedPack] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    async function loadCerts() {
      try {
        const res = await fetch("/api/certifications", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { certifications?: CertificationOption[] };
        setCertifications(json.certifications ?? []);
      } catch { /* non-fatal */ }
    }
    void loadCerts();
  }, []);

  const loadQuestions = useCallback(async () => {
    if (!certificationCode) return;
    setQuestionsLoading(true);
    try {
      const params = new URLSearchParams({ certificationCode, page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (difficulty) params.set("difficulty", difficulty);
      if (topicFilter) params.set("topic", topicFilter);
      const res = await fetch(`/api/admin/questions/available-for-pack?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as AvailableQuestionsPayload;
      setQuestionsData(json);
    } catch {
      // non-fatal
    } finally {
      setQuestionsLoading(false);
    }
  }, [certificationCode, page, pageSize, search, difficulty, topicFilter]);

  useEffect(() => {
    if (step === 2) void loadQuestions();
  }, [step, loadQuestions]);

  function selectAllOnPage() {
    const items = questionsData?.items ?? [];
    const remaining = 65 - selectedIds.size;
    const toAdd = items.filter((q) => !selectedIds.has(q.id)).slice(0, remaining);
    if (toAdd.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const q of toAdd) next.add(q.id);
      return next;
    });
    setSelectedQuestions((prev) => {
      const existingIds = new Set(prev.map((q) => q.id));
      return [...prev, ...toAdd.filter((q) => !existingIds.has(q.id))];
    });
  }

  function deselectAllOnPage() {
    const ids = new Set((questionsData?.items ?? []).map((q) => q.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setSelectedQuestions((prev) => prev.filter((q) => !ids.has(q.id)));
  }

  function toggleSelect(q: AvailableQuestion) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) {
        next.delete(q.id);
        setSelectedQuestions((sq) => sq.filter((item) => item.id !== q.id));
      } else {
        if (next.size >= 65) return prev;
        next.add(q.id);
        setSelectedQuestions((sq) => [...sq, q]);
      }
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/admin/simulado-packs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          certificationCode,
          questionIds: Array.from(selectedIds),
          artworkUrl: artworkUrl ?? undefined,
        }),
      });
      const json = (await res.json()) as { id?: string; name?: string; error?: string };
      if (!res.ok) {
        setSubmitError(json.error ?? "Erro ao criar pack");
        return;
      }
      setCreatedPack({ id: json.id!, name: json.name! });
    } catch {
      setSubmitError("Erro de conexao");
    } finally {
      setSubmitting(false);
    }
  }

  const difficultyColor = (d: string) =>
    d === "easy" ? "text-green-400" : d === "hard" ? "text-red-400" : "text-yellow-400";

  if (createdPack) {
    return (
      <div className="space-y-4 p-2">
        <div className="border border-green-700 bg-green-900/20 px-6 py-8 text-center space-y-4">
          <p className="font-mono text-xs uppercase text-green-400">Pack criado com sucesso!</p>
          <p className="font-mono text-sm text-[#e2e8f0]">{createdPack.name}</p>
          <p className="font-[var(--font-body)] text-xs text-[#94a3b8]">
            {selectedIds.size} questoes adicionadas.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/admin/simulados"
              className="border border-[#334155] px-4 py-2 font-mono text-xs uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316]"
            >
              Ver lista de packs
            </Link>
            <button
              onClick={() => {
                setName(""); setCertificationCode(""); setArtworkUrl(null);
                setSelectedIds(new Set()); setSelectedQuestions([]);
                setStep(1); setCreatedPack(null); setSubmitError(null);
              }}
              className="border border-[#f97316] px-4 py-2 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10"
            >
              Criar outro pack
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/simulados" className="font-mono text-[10px] uppercase text-[#64748b] hover:text-[#f97316]">
            ← Simulados
          </Link>
          <h1 className="mt-1 font-mono text-sm uppercase text-[#f97316]">Simulado Maker</h1>
          <p className="mt-1 text-xs text-[#94a3b8]">Crie um pack de simulado selecionando questoes do banco.</p>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase">
          {([1, 2, 3] as const).map((s) => (
            <span key={s} className={step >= s ? "text-[#f97316]" : "text-[#334155]"}>
              {s === 1 ? "Info" : s === 2 ? "Questoes" : "Confirmar"}
              {s < 3 && <span className="ml-2 text-[#334155]">›</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Step 1 — Pack info */}
      {step === 1 && (
        <div className="border border-[#334155] bg-[#0f172a] p-6 space-y-4 max-w-lg">
          <p className="font-mono text-xs uppercase text-[#f97316]">1. Informacoes do Pack</p>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-[#64748b]">Nome do Pack</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Simulado Zelda"
              className="w-full border border-[#334155] bg-[#111827] px-3 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#f97316]"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-[#64748b]">Certificacao</label>
            <select
              value={certificationCode}
              onChange={(e) => setCertificationCode(e.target.value)}
              className="w-full border border-[#334155] bg-[#111827] px-3 py-2 text-sm text-[#e2e8f0]"
            >
              <option value="">Selecionar...</option>
              {certifications.map((c) => (
                <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>

          <ArtworkUploadField value={artworkUrl} onChange={setArtworkUrl} />

          <button
            onClick={() => setStep(2)}
            disabled={!name.trim() || !certificationCode}
            className="border border-[#f97316] px-6 py-2 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      )}

      {/* Step 2 — Question picker */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar no enunciado..."
                className="border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-[#e2e8f0] outline-none"
              />
              <select
                value={difficulty}
                onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
                className="border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-[#e2e8f0]"
              >
                <option value="">Todas dificuldades</option>
                <option value="easy">Facil</option>
                <option value="medium">Medio</option>
                <option value="hard">Dificil</option>
              </select>
              <input
                value={topicFilter}
                onChange={(e) => { setTopicFilter(e.target.value); setPage(1); }}
                placeholder="Filtrar por topico..."
                className="border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-[#e2e8f0] outline-none"
              />
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-[#e2e8f0]"
              >
                <option value={10}>10 por pag.</option>
                <option value={30}>30 por pag.</option>
                <option value={50}>50 por pag.</option>
                <option value={100}>100 por pag.</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {questionsData && questionsData.items.length > 0 && (() => {
                const pageIds = questionsData.items.map((q) => q.id);
                const allChecked = pageIds.every((id) => selectedIds.has(id));
                return allChecked ? (
                  <button
                    onClick={deselectAllOnPage}
                    className="border border-[#7f1d1d] bg-red-900/10 px-3 py-2 font-mono text-[10px] uppercase text-red-300"
                  >
                    Desmarcar pagina
                  </button>
                ) : (
                  <button
                    onClick={selectAllOnPage}
                    disabled={selectedIds.size >= 65}
                    className="border border-[#334155] px-3 py-2 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316]/50 disabled:opacity-40"
                  >
                    Selecionar pagina
                  </button>
                );
              })()}
              <button
                onClick={() => setShowNewQuestionModal(true)}
                className="border border-[#14532d] bg-green-900/10 px-3 py-2 font-mono text-[10px] uppercase text-green-300 hover:bg-green-900/20"
              >
                + Nova questao
              </button>
              <span className={`font-mono text-xs ${selectedIds.size >= 20 ? "text-green-400" : "text-yellow-400"}`}>
                {selectedIds.size}/65 selecionadas (min: 20)
              </span>
              <button
                onClick={() => setStep(1)}
                className="border border-[#334155] px-3 py-2 font-mono text-[10px] uppercase text-[#94a3b8]"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedIds.size < 20}
                className="border border-[#f97316] px-4 py-2 font-mono text-[10px] uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-40"
              >
                Revisar ({selectedIds.size})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e293b] bg-[#0f172a]">
                  <th className="w-8 px-3 py-2 text-center">
                    {questionsData && questionsData.items.length > 0 && (() => {
                      const pageIds = questionsData.items.map((q) => q.id);
                      const allChecked = pageIds.every((id) => selectedIds.has(id));
                      const someChecked = pageIds.some((id) => selectedIds.has(id));
                      return (
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                          onChange={() => allChecked ? deselectAllOnPage() : selectAllOnPage()}
                          className="accent-[#f97316]"
                          title={allChecked ? "Desmarcar pagina" : "Selecionar pagina"}
                          disabled={!allChecked && selectedIds.size >= 65}
                        />
                      );
                    })()}
                  </th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase text-[#64748b]">Enunciado</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase text-[#64748b]">Topico</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase text-[#64748b]">Dificuldade</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] uppercase text-[#64748b]">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {questionsLoading && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-[#64748b]">Carregando...</td></tr>
                )}
                {!questionsLoading && questionsData?.items.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-[#64748b]">Nenhuma questao disponivel.</td></tr>
                )}
                {!questionsLoading && questionsData?.items.map((q) => {
                  const checked = selectedIds.has(q.id);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => toggleSelect(q)}
                      className={`cursor-pointer border-b border-[#1e293b] hover:bg-white/[0.02] ${checked ? "bg-[#f97316]/5" : ""}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={checked} readOnly className="accent-[#f97316]" />
                      </td>
                      <td className="px-3 py-2 text-[#cbd5e1]">{q.statement}</td>
                      <td className="px-3 py-2 text-[#94a3b8]">{q.topic ?? "—"}</td>
                      <td className={`px-3 py-2 font-mono ${difficultyColor(q.difficulty)}`}>{q.difficulty}</td>
                      <td className="px-3 py-2 font-mono text-[#64748b]">{q.questionType}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {questionsData && questionsData.total > questionsData.pageSize && (
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border border-[#334155] px-3 py-1 uppercase disabled:opacity-30"
              >
                Anterior
              </button>
              <span className="text-[#64748b]">
                {page} / {Math.ceil(questionsData.total / questionsData.pageSize)} ({questionsData.total} questoes)
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(questionsData.total / questionsData.pageSize)}
                className="border border-[#334155] px-3 py-1 uppercase disabled:opacity-30"
              >
                Proxima
              </button>
            </div>
          )}
        </div>
      )}

      {showNewQuestionModal && (
        <QuestionCreateModal
          certifications={certifications}
          defaultCertificationCode={certificationCode}
          onClose={() => setShowNewQuestionModal(false)}
          onCreated={(q: CreatedQuestion) => {
            setShowNewQuestionModal(false);
            const newQ: AvailableQuestion = {
              id: q.id,
              statement: q.statement,
              topic: q.topic,
              difficulty: q.difficulty,
              questionType: q.questionType,
              createdAt: new Date().toISOString(),
            };
            toggleSelect(newQ);
          }}
        />
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <div className="space-y-4 max-w-2xl">
          <div className="border border-[#334155] bg-[#0f172a] p-4 space-y-3">
            <p className="font-mono text-xs uppercase text-[#f97316]">3. Confirmar Criacao</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="font-mono text-[10px] uppercase text-[#64748b]">Nome</p>
                <p className="mt-0.5 text-[#e2e8f0]">{name}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-[#64748b]">Certificacao</p>
                <p className="mt-0.5 text-[#e2e8f0]">{certificationCode}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-[#64748b]">Questoes</p>
                <p className="mt-0.5 text-[#e2e8f0]">{selectedIds.size}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-[#64748b]">Distribuicao</p>
                <p className="mt-0.5 text-[#94a3b8]">
                  {selectedQuestions.filter((q) => q.difficulty === "easy").length} easy ·{" "}
                  {selectedQuestions.filter((q) => q.difficulty === "medium").length} medium ·{" "}
                  {selectedQuestions.filter((q) => q.difficulty === "hard").length} hard
                </p>
              </div>
            </div>
          </div>

          <div className="border border-[#1e293b] bg-[#111827] divide-y divide-[#1e293b] max-h-80 overflow-y-auto">
            {selectedQuestions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-3 px-4 py-2 text-xs">
                <span className="font-mono text-[10px] text-[#334155] w-6 flex-shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[#cbd5e1] truncate">{q.statement}</p>
                  <p className={`font-mono text-[10px] ${difficultyColor(q.difficulty)}`}>{q.difficulty} · {q.topic ?? "—"}</p>
                </div>
                <button
                  onClick={() => toggleSelect(q)}
                  className="text-[#64748b] hover:text-red-400 flex-shrink-0 text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {submitError && (
            <p className="text-xs text-red-400">{submitError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="border border-[#334155] px-4 py-2 font-mono text-xs uppercase text-[#94a3b8]"
            >
              Voltar
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="border border-[#f97316] px-6 py-2 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-40"
            >
              {submitting ? "Criando..." : "Criar Pack"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
