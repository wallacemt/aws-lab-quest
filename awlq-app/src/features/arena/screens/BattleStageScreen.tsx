"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { PixelButton } from "@/components/ui/pixel-button";
import { ArenaLoading } from "@/features/arena/components/ArenaLoading";
import { ArenaScenarioPicker } from "@/features/arena/components/ArenaScenarioPicker";
import { BossBattleStage, type BattleFeedback } from "@/features/arena/components/BossBattleStage";
import { submitBattle, type BossWithBattle } from "@/features/arena/services/arena-api";
import { playDefeatSound, playSuccessSound, triggerConfetti } from "@/features/utils/funcs/simulado-utils";
import { useArenaBattleStore } from "@/stores/arenaBattleStore";
import { useUserProfile } from "@/hooks/useUserProfile";

// ponytail: player HP is a client-only "lives" gate to pace retries — nothing of value
// (XP, boss damage) depends on it, so it doesn't need server persistence like boss HP does.
const PLAYER_MAX_HP = 100;
const PLAYER_DAMAGE_PER_MISS = 20;

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

// Worst case: no streak multiplier, plus every miss the player can take before losing.
function questionsNeeded(boss: BossWithBattle): number {
  const hp = boss.currentBattle?.remainingHp ?? boss.maxHp;
  const maxMisses = PLAYER_MAX_HP / PLAYER_DAMAGE_PER_MISS;
  return Math.min(20, Math.max(1, Math.ceil(hp / boss.damagePerCorrect) + maxMisses));
}

export function BattleStageScreen({ boss }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const startBattle = useArenaBattleStore((s) => s.startBattle);
  const endBattle = useArenaBattleStore((s) => s.endBattle);
  const scenarioId = useArenaBattleStore((s) => s.scenarioId);
  const setScenario = useArenaBattleStore((s) => s.setScenario);
  const { profile, avatarUrl } = useUserProfile();
  const [ready, setReady] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [remainingHp, setRemainingHp] = useState(boss.currentBattle?.remainingHp ?? boss.maxHp);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [streak, setStreak] = useState(0);
  const [victory, setVictory] = useState(false);
  const [defeated, setDefeated] = useState(false);
  const [gainedXp, setGainedXp] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<BattleFeedback>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientPool, setInsufficientPool] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const count = questionsNeeded(boss);
    fetch(`/api/arena/bosses/${boss.id}/questions?count=${count}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load questions");
        const data = (await res.json()) as { questions: Question[]; insufficient?: boolean };
        setQuestions(data.questions);
        // Pool was thin — background generation was enqueued to backfill it for next time.
        setInsufficientPool(Boolean(data.insufficient));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao carregar questões";
        setError(msg);
      })
      .finally(() => setLoadingQuestions(false));
  }, [boss, ready]);

  useEffect(() => {
    if (!ready) return;
    startBattle(pathname, boss.id);
    return () => endBattle();
  }, [pathname, startBattle, endBattle, ready, boss.id]);

  useEffect(() => {
    if (victory || defeated) endBattle();
  }, [victory, defeated, endBattle]);

  const handleSubmitAnswer = useCallback(async () => {
    if (selectedOption === null || submitting) return;

    const question = questions[currentIndex];
    if (!question) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await submitBattle(boss.id, [{ questionId: question.id, selectedOption }]);
      setRemainingHp(result.remainingHp);
      setStreak(result.streak);
      const nextPlayerHp = result.correct ? playerHp : Math.max(0, playerHp - PLAYER_DAMAGE_PER_MISS);
      setPlayerHp(nextPlayerHp);
      setFeedback({ correct: result.correct, damage: result.damage, playerDamage: PLAYER_DAMAGE_PER_MISS });

      const isLastQuestion = currentIndex >= questions.length - 1;
      const isDefeated = nextPlayerHp <= 0 || isLastQuestion;

      setTimeout(() => {
        setFeedback(null);
        setSelectedOption(null);

        if (result.victory) {
          setGainedXp(result.gainedXp ?? 0);
          setVictory(true);
          void triggerConfetti();
          playSuccessSound();
        } else if (isDefeated) {
          setDefeated(true);
          playDefeatSound();
        } else {
          setCurrentIndex((i) => i + 1);
        }
      }, 700);
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_DEFEATED") {
        router.replace(`/arena/${boss.id}/revisao`);
        return;
      }
      const msg = err instanceof Error ? err.message : "Erro ao enviar resposta";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [selectedOption, submitting, questions, currentIndex, boss.id, playerHp, router]);

  if (!ready) {
    return <ArenaScenarioPicker selectedId={scenarioId} onSelect={setScenario} onConfirm={() => setReady(true)} />;
  }

  if (loadingQuestions) {
    return <ArenaLoading />;
  }

  return (
    <div className="mx-auto    max-w-4xl space-y-6 p-4  ">
      <div className="flex items-center gap-3">
        <Link href="/arena" className="font-mono text-xs text-muted underline">
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

      {questions.length === 0 && insufficientPool && (
        <div className="border border-yellow-500/30 bg-[#1a1608] p-3">
          <p className="font-mono text-xs text-yellow-400">
            Ainda nao ha questoes suficientes para este boss na sua certificacao. Estamos gerando mais em segundo
            plano — tente novamente em alguns instantes.
          </p>
        </div>
      )}

      {questions.length > 0 && insufficientPool && (
        <p className="font-mono text-[10px] text-[#64748b]">
          Gerando mais questoes para este boss em segundo plano (nao afeta esta batalha).
        </p>
      )}

      <BossBattleStage
        bossName={boss.name}
        bossArtworkUrl={boss.artworkUrl}
        maxHp={boss.maxHp}
        remainingHp={remainingHp}
        streak={streak}
        playerName={profile.name || "Você"}
        playerAvatarUrl={avatarUrl || "/default-avatar.png"}
        playerMaxHp={PLAYER_MAX_HP}
        playerHp={playerHp}
        question={questions[currentIndex] ?? null}
        selectedOption={selectedOption}
        onSelectOption={setSelectedOption}
        onSubmit={handleSubmitAnswer}
        submitting={submitting}
        feedback={feedback}
        victory={victory}
        defeated={defeated}
      />

      {victory && gainedXp !== null && (
        <div className="space-y-3 border border-[#22c55e]/30 bg-[#052e16] p-4 text-center">
          <p className="font-mono text-sm text-[#22c55e]">+{gainedXp} XP ganhos!</p>
          <Link href={`/arena/${boss.id}/revisao`} className="block">
            <PixelButton className="w-full">Ir para revisão</PixelButton>
          </Link>
        </div>
      )}

      {!victory && !defeated && questions.length > 0 && (
        <p className="text-right font-mono text-[10px] text-[#94a3b8]">
          Questão {currentIndex + 1} / {questions.length}
        </p>
      )}
    </div>
  );
}
