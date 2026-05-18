"use client";

import { useState } from "react";
import { CertificationOption } from "@/features/admin/types";

export type CreatedQuestion = {
  id: string;
  statement: string;
  topic: string;
  difficulty: string;
  questionType: string;
};

type Props = {
  onClose: () => void;
  onCreated: (question: CreatedQuestion) => void;
  certifications: CertificationOption[];
  defaultCertificationCode?: string;
};

const ALL_OPTIONS = ["A", "B", "C", "D", "E"] as const;
type OptionKey = (typeof ALL_OPTIONS)[number];

export function QuestionCreateModal({ onClose, onCreated, certifications, defaultCertificationCode }: Props) {
  const [statement, setStatement] = useState("");
  const [options, setOptions] = useState<Record<OptionKey, string>>({ A: "", B: "", C: "", D: "", E: "" });
  const [questionType, setQuestionType] = useState<"single" | "multi">("single");
  const [correctOption, setCorrectOption] = useState<OptionKey>("A");
  const [correctOptions, setCorrectOptions] = useState<OptionKey[]>(["A"]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [topic, setTopic] = useState("");
  const [certCode, setCertCode] = useState(defaultCertificationCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setOption(key: OptionKey, value: string) {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMultiCorrect(opt: OptionKey) {
    setCorrectOptions((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : ([...prev, opt].sort() as OptionKey[]),
    );
  }

  const filledOptions = ALL_OPTIONS.filter((o) => options[o].trim());

  async function handleSave() {
    if (!statement.trim()) { setError("Enunciado obrigatorio"); return; }
    if (filledOptions.length < 2) { setError("Minimo 2 opcoes preenchidas"); return; }

    const correct: OptionKey[] = questionType === "multi" ? correctOptions : [correctOption];
    if (correct.length === 0) { setError("Marque pelo menos uma resposta correta"); return; }
    for (const c of correct) {
      if (!options[c]?.trim()) { setError(`Opcao correta ${c} nao esta preenchida`); return; }
    }

    const optionsPayload: Partial<Record<OptionKey, string>> = {};
    for (const o of ALL_OPTIONS) {
      if (options[o].trim()) optionsPayload[o] = options[o].trim();
    }

    setSaving(true);
    setError(null);
    try {
      const question = {
        statement: statement.trim(),
        options: optionsPayload,
        ...(questionType === "multi" ? { correctOptions: correct } : { correctOption: correct[0] }),
        difficulty,
        questionType,
        topic: topic.trim() || "OUTROS",
        certificationCode: certCode || undefined,
      };

      const res = await fetch("/api/admin/questions/import-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questions: [question] }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const errMsg = Array.isArray(data.errors)
          ? (data.errors as string[]).slice(0, 3).join(" | ")
          : String(data.error ?? "Erro ao salvar");
        setError(errMsg);
        return;
      }
      const id = (data.ids as string[])[0]!;
      onCreated({ id, statement: statement.trim(), topic: topic.trim() || "OUTROS", difficulty, questionType });
    } catch {
      setError("Falha na requisicao");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 pb-4 pt-8 grid place-items-start justify-center">
      <div className="w-full max-w-2xl space-y-4 border border-[#334155] bg-[#111827] p-5 text-[#e2e8f0]">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase text-[#f97316]">Nova questao</p>
          <button type="button" onClick={onClose} className="text-xs text-[#64748b] hover:text-[#e2e8f0]">
            ✕ Fechar
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs uppercase text-[#64748b]">Enunciado *</span>
          <textarea
            rows={3}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="Digite o enunciado da questao..."
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs uppercase text-[#64748b]">Opcoes (A e B obrigatorias)</span>
          {ALL_OPTIONS.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <span className="w-4 shrink-0 font-mono text-xs text-[#94a3b8]">{opt}</span>
              <input
                value={options[opt]}
                onChange={(e) => setOption(opt, e.target.value)}
                placeholder={opt === "A" || opt === "B" ? "Obrigatorio" : "Opcional"}
                className="flex-1 border border-[#334155] bg-[#0b1220] px-3 py-1.5 text-sm text-[#e2e8f0] outline-none"
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs uppercase text-[#64748b]">Tipo</span>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as "single" | "multi")}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0]"
            >
              <option value="single">Single choice</option>
              <option value="multi">Multi choice</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase text-[#64748b]">Dificuldade</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0]"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase text-[#64748b]">Topico</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="ex: S3, IAM, VPC"
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase text-[#64748b]">
            Resposta{questionType === "multi" ? "s corretas" : " correta"}
          </span>
          <div className="flex flex-wrap gap-2">
            {filledOptions.map((o) => {
              const isCorrect =
                questionType === "multi" ? correctOptions.includes(o) : correctOption === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => (questionType === "multi" ? toggleMultiCorrect(o) : setCorrectOption(o))}
                  className={[
                    "border px-4 py-1.5 font-mono text-xs transition-colors",
                    isCorrect
                      ? "border-green-600 bg-green-900/20 text-green-400"
                      : "border-[#334155] text-[#64748b] hover:border-[#475569]",
                  ].join(" ")}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs uppercase text-[#64748b]">Certificacao</span>
          <select
            value={certCode}
            onChange={(e) => setCertCode(e.target.value)}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0]"
          >
            <option value="">Sem certificacao</option>
            {certifications.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="border border-[#14532d] bg-green-900/20 px-4 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Criar questao"}
          </button>
        </div>
      </div>
    </div>
  );
}
