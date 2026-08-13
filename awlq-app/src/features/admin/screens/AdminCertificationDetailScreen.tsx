"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchAdminCertificationDetail,
  updateAdminCertification,
  uploadExamGuide,
  type ExamGuideUploadConflict,
} from "@/features/admin/services/admin-api";
import type { AdminCertificationDetail } from "@/features/admin/types";

type Props = {
  certificationId: string;
};

export function AdminCertificationDetailScreen({ certificationId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<AdminCertificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examMinutes, setExamMinutes] = useState(90);
  const [active, setActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [examGuideFile, setExamGuideFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ExamGuideUploadConflict | null>(null);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchAdminCertificationDetail(certificationId);
      setData(detail);
      setName(detail.name);
      setDescription(detail.description);
      setExamMinutes(detail.examMinutes);
      setActive(detail.active);
      setDisplayOrder(detail.displayOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar certificacao.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificationId]);

  async function handleSaveEdit() {
    setEditSaving(true);
    setEditError(null);
    setEditMsg(null);
    try {
      await updateAdminCertification(certificationId, { name, description, examMinutes, active, displayOrder });
      setEditMsg("Certificacao atualizada.");
      await loadDetail();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setEditSaving(false);
    }
  }

  async function submitExamGuide(overwriteConfirmed: boolean) {
    if (!data) return;
    setUploading(true);
    setUploadError(null);
    setUploadMsg(null);
    setConflict(null);
    try {
      const result = await uploadExamGuide({
        certificationCode: data.code,
        file: examGuideFile ?? undefined,
        manualText: manualText.trim() || undefined,
        overwriteConfirmed,
      });
      setUploadMsg(`${result.message} (${result.characters} caracteres)`);
      setExamGuideFile(null);
      setManualText("");
      await loadDetail();
    } catch (err) {
      const conflictErr = err as Error & { conflict?: ExamGuideUploadConflict };
      if (conflictErr.conflict) {
        setConflict(conflictErr.conflict);
      }
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar Exam Guide.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="font-mono text-xs uppercase text-[#94a3b8] animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (error || !data) {
    return <p className="font-mono text-xs uppercase text-[#fca5a5]">{error ?? "Certificacao nao encontrada."}</p>;
  }

  return (
    <main className="space-y-5">
      <header>
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-2 border border-[#334155] px-3 py-1 text-xs uppercase text-[#94a3b8]"
        >
          ← Voltar
        </button>
        <p className="font-mono text-xs uppercase text-[#f97316]">Admin / Certificacoes</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">
          {data.code} — {data.name}
        </h1>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Questoes", value: String(data._count.questions) },
          { label: "Usuarios alvo", value: String(data._count.userProfiles) },
          { label: "Duracao (min)", value: String(data.examMinutes) },
          { label: "Exam Guide", value: data.hasExamGuide ? "Enviado" : "Pendente" },
        ].map(({ label, value }) => (
          <div key={label} className="border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">{label}</p>
            <p className="mt-1 font-mono text-lg text-[#f8fafc]">{value}</p>
          </div>
        ))}
      </div>

      {/* Edit form */}
      <div className="border border-[#1e293b] bg-[#111827] p-4 space-y-3">
        <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Editar certificacao</p>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Descricao</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase text-[#64748b]">Duracao da prova (min)</span>
            <input
              type="number"
              min={1}
              value={examMinutes}
              onChange={(e) => setExamMinutes(Number(e.target.value))}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase text-[#64748b]">Ordem de exibicao</span>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            />
          </label>
          <label className="flex items-center gap-2 pt-5 font-mono text-xs uppercase text-[#e2e8f0]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-green-400" />
            Ativa
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSaveEdit()}
            disabled={editSaving}
            className="border border-[#f97316] px-3 py-1.5 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-50"
          >
            {editSaving ? "Salvando..." : "Salvar alteracoes"}
          </button>
          {editMsg && <p className="font-mono text-xs text-[#86efac]">{editMsg}</p>}
          {editError && <p className="font-mono text-xs text-[#fca5a5]">{editError}</p>}
        </div>
      </div>

      {/* Exam guide upload */}
      <div className="border border-[#1e293b] bg-[#111827] p-4 space-y-3">
        <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Exam Guide</p>

        {data.latestExamGuideUpload && (
          <p className="text-xs text-[#64748b]">
            Ultimo envio: {data.latestExamGuideUpload.fileName} em{" "}
            {new Date(data.latestExamGuideUpload.createdAt).toLocaleString("pt-BR")}
            {data.latestExamGuideUpload.uploadedBy && ` por ${data.latestExamGuideUpload.uploadedBy.name}`}
          </p>
        )}

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Arquivo PDF</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setExamGuideFile(e.target.files?.[0] ?? null)}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Ou cole o texto do guia manualmente</span>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={4}
            placeholder="Topicos e percentuais do exam guide..."
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void submitExamGuide(false)}
            disabled={uploading || (!examGuideFile && !manualText.trim())}
            className="border border-[#f97316] px-3 py-1.5 font-mono text-xs uppercase text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-50"
          >
            {uploading ? "Processando..." : "Enviar Exam Guide"}
          </button>
          {uploadMsg && <p className="font-mono text-xs text-[#86efac]">{uploadMsg}</p>}
          {uploadError && <p className="font-mono text-xs text-[#fca5a5]">{uploadError}</p>}
        </div>

        {conflict && (
          <div className="border border-yellow-700 bg-yellow-900/20 p-3 space-y-2">
            <p className="font-mono text-xs text-yellow-300">
              Ja existe um Exam Guide salvo para {conflict.certificationName} (atualizado em{" "}
              {new Date(conflict.updatedAt).toLocaleString("pt-BR")}). Confirme para sobrescrever.
            </p>
            <button
              type="button"
              onClick={() => void submitExamGuide(true)}
              disabled={uploading}
              className="border border-yellow-500 px-3 py-1 font-mono text-[10px] uppercase text-yellow-300 hover:bg-yellow-900/40"
            >
              Confirmar sobrescrita
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
