"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BossBattleStage } from "@/features/arena/components/BossBattleStage";
import { submitBattle, type BossWithBattle } from "@/features/arena/services/arena-api";

type Question = {
  id: string;
  statement: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
};

type Props = {
  boss: BossWithBattle;
};

const QUESTION_COUNT = 5;

export function BattleStageScreen({ boss }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; selectedOption: number }[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [remainingHp, setRemainingHp] = useState(boss.currentBattle?.remainingHp ?? boss.maxHp);
  const [victory, setVictory] = useState(false);
  const [gainedXp, setGainedXp] = useState<number | null>(null);
  const [damageFlash, setDamageFlash] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load questions for this boss's theme service
    fetch(`/api/arena/bosses/${boss.id}/questions?count=${QUESTION_COUNT}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load questions");
        const data = (await res.json()) as { questions: Question[] };
        setQuestions(data.questions);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao carregar questões";
        setError(msg);
      })
      .finally(() => setLoadingQuestions(false));
  }, [boss.id]);

  const handleSubmitAnswer = useCallback(async () => {
    if (selectedOption === null || submitting) return;

    const question = questions[currentIndex];
    if (!question) return;

    const newAnswers = [...answers, { questionId: question.id, selectedOption }];
    const isLastQuestion = currentIndex >= questions.length - 1;

    if (!isLastQuestion) {
      // Accumulate answers until the last question
      setAnswers(newAnswers);
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      return;
    }

    // Submit all accumulated answers
    setSubmitting(true);
    setError(null);

    try {
      const result = await submitBattle(boss.id, newAnswers);
      const prevHp = remainingHp;
      setRemainingHp(result.remainingHp);
      const damage = prevHp - result.remainingHp;
      if (damage > 0) {
        setDamageFlash(damage);
        setTimeout(() => setDamageFlash(null), 1500);
      }
      if (result.victory) {
        setVictory(true);
        setGainedXp(result.gainedXp ?? 0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar resposta";
      setError(msg);
    } finally {
      setSubmitting(false);
      setAnswers([]);
      setSelectedOption(null);
      if (!victory) {
        setCurrentIndex(0);
      }
    }
  }, [selectedOption, submitting, questions, currentIndex, answers, boss.id, remainingHp, victory]);

  if (loadingQuestions) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Preparando batalha...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Link href="/arena" className="font-mono text-xs text-[#94a3b8] underline">
          Voltar
        </Link>
        <span className="font-mono text-xs text-[#334155]">/</span>
        <p className="font-mono text-xs text-[#e2e8f0]">{boss.name}</p>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-[#1a0a0a] p-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      <BossBattleStage
        bossName={boss.name}
        bossArtworkUrl={boss.artworkUrl}
        maxHp={boss.maxHp}
        remainingHp={remainingHp}
        question={questions[currentIndex] ?? null}
        selectedOption={selectedOption}
        onSelectOption={setSelectedOption}
        onSubmit={handleSubmitAnswer}
        submitting={submitting}
        damageFlash={damageFlash}
        victory={victory}
      />

      {victory && gainedXp !== null && (
        <div className="border border-[#22c55e]/30 bg-[#052e16] p-4 text-center">
          <p className="font-mono text-sm text-[#22c55e]">+{gainedXp} XP ganhos!</p>
        </div>
      )}

      {!victory && questions.length > 0 && (
        <p className="text-right font-mono text-[10px] text-[#94a3b8]">
          Questão {currentIndex + 1} / {questions.length}
        </p>
      )}
    </div>
  );
}
