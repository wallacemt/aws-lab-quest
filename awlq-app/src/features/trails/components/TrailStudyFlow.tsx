"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import {
  fetchStageExplain,
  fetchStageQuestions,
  completeStage,
  type TrailQuestion,
} from "@/features/trails/services/trails-api";
import { RetroIcon } from "@/components/ui/retro-loading";

// ─── State machine ────────────────────────────────────────────────────────────

type Phase =
  | { tag: "loading_explain" }
  | { tag: "explain"; markdown: string }
  | { tag: "loading_questions" }
  | { tag: "quiz"; questions: TrailQuestion[]; idx: number; selected: string | null; revealed: boolean }
  | { tag: "quiz_failed"; correct: number; total: number }
  | { tag: "victory" };

// ─── Confetti particles ───────────────────────────────────────────────────────

const CONFETTI = Array.from({ length: 20 }, (_, i) => ({
  x: Math.random() * 100,
  delay: Math.random() * 0.6,
  color: ["#f97316", "#22c55e", "#38bdf8", "#a78bfa", "#f59e0b"][i % 5],
}));

function VictoryScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center relative overflow-hidden">
      {/* Confetti */}
      {CONFETTI.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2"
          style={{ left: `${p.x}%`, top: -8, backgroundColor: p.color }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 320, opacity: 0, rotate: 720 }}
          transition={{ duration: 1.8, delay: p.delay, ease: "easeIn" }}
        />
      ))}

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-6xl"
      >
        🏆
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-2"
      >
        <p className="font-mono text-xl font-bold uppercase text-[var(--pixel-accent)]">Estágio Concluído!</p>
        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
          Você acertou todas as questões e avançou na trilha.
        </p>
      </motion.div>

      <PixelButton onClick={onClose}>Continuar trilha</PixelButton>
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

type QuizCardProps = {
  question: TrailQuestion;
  idx: number;
  total: number;
  selected: string | null;
  revealed: boolean;
  onSelect: (key: string) => void;
  onConfirm: () => void;
};

function QuizCard({ question, idx, total, selected, revealed, onSelect, onConfirm }: QuizCardProps) {
  const isCorrect = selected === question.correctKey;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-muted)]">
          Questão {idx + 1} de {total}
        </p>
        {/* Progress dots */}
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 ${
                i < idx
                  ? "bg-[var(--pixel-accent)]"
                  : i === idx
                    ? "bg-[var(--pixel-primary)]"
                    : "bg-[var(--pixel-border)]"
              }`}
            />
          ))}
        </div>
      </div>

      <PixelCard>
        <p className="font-[var(--font-body)] text-sm leading-relaxed text-[var(--pixel-text)]">{question.statement}</p>
      </PixelCard>

      <div className="flex flex-col gap-2">
        {question.options.map((opt) => {
          let optClass =
            "border border-[var(--pixel-border)] bg-[var(--pixel-card)] hover:border-[var(--pixel-accent)] cursor-pointer";
          if (selected === opt.key && !revealed) {
            optClass = "border-2 border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10 cursor-pointer";
          }
          if (revealed) {
            if (opt.key === question.correctKey) {
              optClass = "border-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10 cursor-default";
            } else if (selected === opt.key) {
              optClass = "border-2 border-red-500 bg-red-950/20 cursor-default";
            } else {
              optClass = "border border-[var(--pixel-border)] bg-[var(--pixel-card)] opacity-50 cursor-default";
            }
          }

          return (
            <button
              key={opt.key}
              type="button"
              disabled={revealed}
              onClick={() => onSelect(opt.key)}
              className={`flex items-start gap-3 p-3 text-left transition-colors ${optClass}`}
            >
              <span className="shrink-0 font-mono text-xs font-bold text-[var(--pixel-muted)]">{opt.key}</span>
              <span className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <PixelCard className={isCorrect ? "border-[var(--pixel-accent)]/60" : "border-red-500/40"}>
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-muted)] mb-1">
            {isCorrect ? "✓ Correto!" : `✗ Incorreto — Resposta: ${question.correctKey}`}
          </p>
          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{question.explanation}</p>
        </PixelCard>
      )}

      {!revealed && (
        <PixelButton disabled={!selected} onClick={onConfirm}>
          Confirmar
        </PixelButton>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  chainId: string;
  stage: { id: string; title: string };
  onClose: () => void;
  onCompleted: (stageId: string, unlockedNextId: string | undefined) => void;
};

export function TrailStudyFlow({ chainId, stage, onClose, onCompleted }: Props) {
  const [phase, setPhase] = useState<Phase>({ tag: "loading_explain" });
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Start: load explanation on mount
  useState(() => {
    void (async () => {
      setError(null);
      try {
        const { markdown } = await fetchStageExplain(chainId, stage.id);
        setPhase({ tag: "explain", markdown });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar explicação.");
        setPhase({ tag: "explain", markdown: "" });
      }
    })();
  });

  async function startQuiz() {
    setPhase({ tag: "loading_questions" });
    setCorrectCount(0);
    setError(null);
    try {
      const { questions } = await fetchStageQuestions(chainId, stage.id);
      setPhase({ tag: "quiz", questions, idx: 0, selected: null, revealed: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar questões.");
      setPhase({
        tag: "explain",
        markdown: phase.tag === "loading_questions" ? "" : ((phase as { markdown?: string }).markdown ?? ""),
      });
    }
  }

  function handleSelect(key: string) {
    if (phase.tag !== "quiz") return;
    setPhase({ ...phase, selected: key });
  }

  function handleConfirm() {
    if (phase.tag !== "quiz" || !phase.selected) return;
    setPhase({ ...phase, revealed: true });
  }

  async function handleNext() {
    if (phase.tag !== "quiz" || !phase.revealed) return;
    const isCorrect = phase.selected === phase.questions[phase.idx]?.correctKey;
    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    const isLast = phase.idx >= phase.questions.length - 1;

    if (!isLast) {
      setCorrectCount(newCorrect);
      setPhase({ ...phase, idx: phase.idx + 1, selected: null, revealed: false });
      return;
    }

    // Last question — evaluate
    const allCorrect = newCorrect === phase.questions.length;
    if (allCorrect) {
      // Complete stage via API
      try {
        const result = await completeStage(chainId, stage.id);
        onCompleted(stage.id, result.unlockedNext);
      } catch {
        // Non-fatal — still show victory
      }
      setPhase({ tag: "victory" });
    } else {
      setPhase({ tag: "quiz_failed", correct: newCorrect, total: phase.questions.length });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full h-full overflow-y-auto"
      >
        <PixelCard className="space-y-4 overflow-auto h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase text-accent tracking-widest">
                {phase.tag === "explain" || phase.tag === "loading_explain"
                  ? "Explicação da IA"
                  : phase.tag === "loading_questions"
                    ? "Gerando questões..."
                    : phase.tag === "quiz"
                      ? "Quiz"
                      : phase.tag === "quiz_failed"
                        ? "Tente novamente"
                        : "Vitória!"}
              </p>
              <h2 className="font-mono text-base font-bold uppercase text-primary mt-0.5">{stage.title}</h2>
            </div>
            {phase.tag !== "victory" && (
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-xs text-pixel-subtext hover:text-primary transition-colors shrink-0"
              >
                ✕ Fechar
              </button>
            )}
          </div>

          {error && (
            <PixelCard className="border-red-500/40">
              <p className="font-mono text-xs text-red-400">{error}</p>
            </PixelCard>
          )}

          {/* Loading explain */}
          {phase.tag === "loading_explain" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <RetroIcon />
              <p className="font-mono text-xs text-pixel-subtext">Gerando explicação personalizada...</p>
            </div>
          )}

          {/* Explanation */}
          {phase.tag === "explain" && phase.markdown && (
            <>
              <div className="max-h-[70vh] text-wrap overflow-y-auto border border-pixel-border bg-pixel-card p-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="mb-2 font-mono text-sm uppercase text-primary">{children}</h1>,
                    h2: ({ children }) => (
                      <h2 className="mb-2 mt-4 font-mono text-xs uppercase text-accent">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-1 mt-3 font-mono text-[11px] uppercase text-accent">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 font-sans text-sm leading-6 text-pixel-subtext">{children}</p>
                    ),
                    li: ({ children }) => (
                      <li className="mb-1 ml-4 list-disc font-sans text-sm text-pixel-subtext">{children}</li>
                    ),
                    ul: ({ children }) => <ul className="mb-2 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 list-decimal ml-4 space-y-0.5">{children}</ol>,
                    strong: ({ children }) => <strong className="font-semibold text-pixel-text">{children}</strong>,
                    code: ({ children }) => (
                      <code className="bg-pixel-border/10 rounded-md px-1 py-0.5 font-mono text-xs text-accent">
                        {children}
                      </code>
                    ),
                    hr: () => <hr className="my-3 border-pixel-border" />,
                  }}
                >
                  {phase.markdown}
                </ReactMarkdown>
              </div>
              <div className="flex gap-3">
                <PixelButton onClick={() => void startQuiz()} className="flex-1">
                  Estou pronto — Iniciar Quiz
                </PixelButton>
                <PixelButton variant="ghost" onClick={onClose} className="shrink-0">
                  Voltar
                </PixelButton>
              </div>
            </>
          )}

          {/* Loading questions */}
          {phase.tag === "loading_questions" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <RetroIcon />
              <p className="font-mono text-xs text-pixel-subtext">Gerando 10 questões sobre {stage.title}...</p>
            </div>
          )}

          {/* Quiz */}
          {phase.tag === "quiz" && (
            <>
              <QuizCard
                question={phase.questions[phase.idx]!}
                idx={phase.idx}
                total={phase.questions.length}
                selected={phase.selected}
                revealed={phase.revealed}
                onSelect={handleSelect}
                onConfirm={handleConfirm}
              />
              {phase.revealed && (
                <PixelButton onClick={() => void handleNext()}>
                  {phase.idx >= phase.questions.length - 1 ? "Ver resultado" : "Próxima questão →"}
                </PixelButton>
              )}
            </>
          )}

          {/* Failed */}
          {phase.tag === "quiz_failed" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="text-4xl">😓</p>
              <div>
                <p className="font-mono text-base font-bold text-pixel-text">
                  {phase.correct}/{phase.total} corretas
                </p>
                <p className="mt-1 font-sans text-sm text-pixel-subtext">
                  Você precisa acertar todas as {phase.total} questões para avançar. Revise a explicação e tente
                  novamente!
                </p>
              </div>
              <div className="flex gap-3">
                <PixelButton onClick={() => setPhase({ tag: "explain", markdown: "" })} className="flex-1">
                  Reler explicação
                </PixelButton>
                <PixelButton variant="ghost" onClick={() => void startQuiz()}>
                  Novo quiz
                </PixelButton>
              </div>
            </div>
          )}

          {/* Victory */}
          {phase.tag === "victory" && <VictoryScreen onClose={onClose} />}
        </PixelCard>
      </motion.div>
    </div>
  );
}
