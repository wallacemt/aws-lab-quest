"use client";

import { useMemo, useState } from "react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ReportQuestionReason } from "@/features/study/services";

const REPORT_REASON_OPTIONS: Array<{ value: ReportQuestionReason; label: string }> = [
  { value: "INCORRECT_ANSWER", label: "Resposta correta incorreta" },
  { value: "UNCLEAR_STATEMENT", label: "Enunciado confuso" },
  { value: "MISSING_CONTEXT", label: "Falta contexto" },
  { value: "GRAMMAR_TYPO", label: "Erro de texto/portugues" },
  { value: "DUPLICATE", label: "Questao duplicada" },
  { value: "QUALITY_ISSUE", label: "Problema de qualidade" },
  { value: "OTHER", label: "Outro" },
];

type ReportQuestionModalProps = {
  open: boolean;
  questionStatement: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason: ReportQuestionReason; description: string }) => Promise<void>;
};

export function ReportQuestionModal({
  open,
  questionStatement,
  submitting = false,
  onClose,
  onSubmit,
}: ReportQuestionModalProps) {
  const [reason, setReason] = useState<ReportQuestionReason>("INCORRECT_ANSWER");
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmedStatement = useMemo(() => {
    return questionStatement.trim().slice(0, 220);
  }, [questionStatement]);

  if (!open) {
    return null;
  }

  async function handleSubmit() {
    setLocalError(null);

    try {
      await onSubmit({
        reason,
        description: description.trim().slice(0, 500),
      });
      setDescription("");
      onClose();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Nao foi possivel enviar denuncia.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <PixelCard className="w-full max-w-xl space-y-4">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Denunciar questao</p>
        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">{trimmedStatement}</p>

        <label className="space-y-1 text-xs">
          <span className="font-mono uppercase text-[var(--pixel-subtext)]">Motivo</span>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportQuestionReason)}
            className="w-full border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
            disabled={submitting}
          >
            {REPORT_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="font-mono uppercase text-[var(--pixel-subtext)]">Detalhes (opcional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 500))}
            rows={4}
            className="w-full resize-none border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
            placeholder="Descreva rapidamente o problema encontrado."
            disabled={submitting}
          />
          <p className="text-right font-mono text-[10px] text-[var(--pixel-subtext)]">{description.length}/500</p>
        </label>

        {localError && <p className="text-sm text-red-300">{localError}</p>}

        <div className="flex justify-end gap-2">
          <PixelButton variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </PixelButton>
          <PixelButton onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar denuncia"}
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
}
