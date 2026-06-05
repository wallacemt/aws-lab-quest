"use client";

import { useEffect, useState } from "react";

type Question = {
  id: string;
  statement: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
};

type QuizState =
  | { status: "loading" }
  | { status: "locked"; reason: string }
  | { status: "no-quiz" }
  | { status: "completed"; score: number; totalCount: number; gainedXp: number; completedAt: string }
  | { status: "ready"; quizId: string; questions: Question[] }
  | { status: "submitted"; score: number; totalCount: number; gainedXp: number };

const OPTIONS = ["A", "B", "C", "D", "E"] as const;

export function DailyQuizScreen() {
  const [state, setState] = useState<QuizState>({ status: "loading" });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/daily-quiz")
      .then(async (res) => {
        const data = (await res.json()) as {
          locked?: boolean;
          reason?: string;
          completed?: boolean;
          attempt?: { score: number; totalCount: number; gainedXp: number; completedAt: string };
          quiz?: { id: string; questions: Question[] };
        };

        if (data.locked) {
          setState({ status: "locked", reason: data.reason ?? "Bloqueado" });
          return;
        }

        if (data.completed && data.attempt) {
          setState({
            status: "completed",
            score: data.attempt.score,
            totalCount: data.attempt.totalCount,
            gainedXp: data.attempt.gainedXp,
            completedAt: data.attempt.completedAt,
          });
          return;
        }

        if (!data.quiz) {
          setState({ status: "no-quiz" });
          return;
        }

        setState({ status: "ready", quizId: data.quiz.id, questions: data.quiz.questions });
      })
      .catch(() => {
        setState({ status: "no-quiz" });
      });
  }, []);

  async function handleSubmit() {
    if (state.status !== "ready") return;

    const answersArr = Object.entries(answers).map(([questionId, selectedOption]) => ({
      questionId,
      selectedOption,
    }));

    if (answersArr.length < state.questions.length) {
      setError("Responda todas as questões antes de enviar.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/daily-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersArr }),
      });

      if (res.status === 409) {
        setError("Você já respondeu o quiz de hoje.");
        return;
      }

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setError(err.error ?? "Erro ao enviar respostas.");
        return;
      }

      const data = (await res.json()) as { score: number; totalCount: number; gainedXp: number };
      setState({ status: "submitted", score: data.score, totalCount: data.totalCount, gainedXp: data.gainedXp });
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Carregando quiz...</p>
      </div>
    );
  }

  if (state.status === "locked") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <h1 className="font-mono text-lg font-bold uppercase text-[#f97316]">Quiz Diário</h1>
        <div className="border border-[#334155] bg-[#0f172a] p-6 text-center space-y-3">
          <p className="font-mono text-2xl text-[#94a3b8]">Bloqueado</p>
          <p className="font-[var(--font-body)] text-sm text-[#cbd5e1]">{state.reason}</p>
        </div>
      </div>
    );
  }

  if (state.status === "no-quiz") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <h1 className="font-mono text-lg font-bold uppercase text-[#f97316]">Quiz Diário</h1>
        <div className="border border-[#1e293b] bg-[#0f172a] p-6 text-center">
          <p className="font-mono text-xs text-[#94a3b8]">Quiz de hoje ainda não foi gerado. Volte mais tarde.</p>
        </div>
      </div>
    );
  }

  if (state.status === "completed" || state.status === "submitted") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <h1 className="font-mono text-lg font-bold uppercase text-[#f97316]">Quiz Diário</h1>
        <div className="border border-[#22c55e]/30 bg-[#052e16] p-6 space-y-2 text-center">
          <p className="font-mono text-lg text-[#22c55e]">
            {state.score} / {state.totalCount} corretas
          </p>
          <p className="font-mono text-sm text-[#86efac]">+{state.gainedXp} XP</p>
          {"completedAt" in state && (
            <p className="font-mono text-[10px] text-[#94a3b8]">
              Completado em {new Date(state.completedAt).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
        <p className="font-mono text-xs text-[#94a3b8] text-center">
          Volte amanhã para um novo quiz!
        </p>
      </div>
    );
  }

  // ready
  const { questions } = state;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="font-mono text-lg font-bold uppercase text-[#f97316]">Quiz Diário</h1>
        <p className="mt-1 font-mono text-xs text-[#94a3b8]">{questions.length} questões — 1 tentativa por dia</p>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-[#1a0a0a] p-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, qIdx) => (
          <div key={q.id} className="space-y-2 border border-[#1e293b] bg-[#0f172a] p-4">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Questão {qIdx + 1}</p>
            <p className="font-[var(--font-body)] text-sm leading-6 text-[#e2e8f0]">{q.statement}</p>
            <div className="space-y-2">
              {OPTIONS.map((letter, idx) => {
                const text = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE][idx];
                if (!text) return null;
                const isSelected = answers[q.id] === idx;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                    className={[
                      "w-full border px-4 py-2 text-left font-mono text-xs transition-colors",
                      isSelected
                        ? "border-[#f97316] bg-[#1f2937] text-[#f97316]"
                        : "border-[#1e293b] text-[#cbd5e1] hover:border-[#334155]",
                    ].join(" ")}
                  >
                    <span className="mr-3 font-bold">{letter}.</span>
                    {text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full border border-[#f97316] bg-[#f97316]/10 px-4 py-3 font-mono text-xs font-bold uppercase text-[#f97316] transition-colors hover:bg-[#f97316]/20 disabled:opacity-50"
        >
          {submitting ? "Enviando..." : "Enviar Respostas"}
        </button>
      </div>
    </div>
  );
}
