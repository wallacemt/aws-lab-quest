"use client";

import { useEffect, useState } from "react";
import {
  fetchWeeklyChallenge,
  submitWeeklyChallenge,
  type WeeklyChallengeData,
} from "@/features/arena/services/arena-api";
import { WeeklyChallengeCard } from "@/features/arena/components/WeeklyChallengeCard";

type Question = {
  id: string;
  statement: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
};

const OPTIONS = ["A", "B", "C", "D", "E"] as const;
const QUESTION_COUNT = 10;

export function WeeklyChallengeScreen() {
  const [challengeData, setChallengeData] = useState<WeeklyChallengeData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; gainedXp: number } | null>(null);

  useEffect(() => {
    fetchWeeklyChallenge()
      .then((data) => {
        setChallengeData(data);
        if (!data.submitted && data.challenge) {
          // Load questions for the challenge
          return fetch(`/api/study/questions?count=${QUESTION_COUNT}&usage=KC`)
            .then(async (res) => {
              if (!res.ok) return;
              const d = (await res.json()) as { questions: Question[] };
              setQuestions(d.questions ?? []);
            });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao carregar desafio";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    const answersArr = Object.entries(answers).map(([questionId, selectedOption]) => ({
      questionId,
      selectedOption,
    }));

    if (answersArr.length === 0) {
      setError("Responda ao menos uma questão antes de enviar.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await submitWeeklyChallenge(answersArr);
      setResult({ score: res.score, gainedXp: res.gainedXp });
      const updated = await fetchWeeklyChallenge();
      setChallengeData(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar respostas";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Carregando desafio...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="font-mono text-lg font-bold uppercase text-[#f97316]">Desafio Semanal</h1>
        <p className="mt-1 font-mono text-xs text-[#94a3b8]">Compita com todos os usuários</p>
      </div>

      {challengeData && <WeeklyChallengeCard data={challengeData} />}

      {error && (
        <div className="border border-red-500/30 bg-[#1a0a0a] p-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="border border-[#22c55e]/30 bg-[#052e16] p-4">
          <p className="font-mono text-sm text-[#22c55e]">
            Pontuação: {result.score} | +{result.gainedXp} XP
          </p>
        </div>
      )}

      {!challengeData?.submitted && questions.length > 0 && !result && (
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase text-[#94a3b8]">
            {questions.length} questões — responda todas antes de enviar
          </p>

          {questions.map((q, qIdx) => (
            <div key={q.id} className="space-y-2 border border-[#1e293b] bg-[#0f172a] p-4">
              <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Questão {qIdx + 1}</p>
              <p className="font-[var(--font-body)] text-sm leading-6 text-[#e2e8f0]">
                {q.statement}
              </p>
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
      )}
    </div>
  );
}
