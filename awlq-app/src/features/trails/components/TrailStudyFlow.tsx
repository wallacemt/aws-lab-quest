"use client";

import { useEffect, useMemo, useState } from "react";
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
import { QuestionOptionsCard, type QuestionCardQuestion } from "@/features/study/components/QuestionOptionsCard";
import type { QuestionOption } from "@/lib/types";

// ─── State machine ────────────────────────────────────────────────────────────

type AnsweredQuestion = { question: TrailQuestion; selected: string | null };

type Phase =
  | { tag: "loading_explain" }
  | { tag: "explain" }
  | { tag: "loading_questions" }
  | { tag: "quiz"; questions: TrailQuestion[]; idx: number; selected: string | null; revealed: boolean }
  | { tag: "quiz_failed" }
  | { tag: "review" }
  | { tag: "victory" };

// ─── Themed loading messages ──────────────────────────────────────────────────

const EXPLAIN_LOADING_MESSAGES = [
  "Consultando os arquitetos da AWS...",
  "Organizando os conceitos em ordem didática...",
  "Preparando analogias para fixar o conteúdo...",
  "Quase lá — revisando a explicação...",
];

function questionsLoadingMessages(title: string) {
  return [
    `Bolando pegadinhas sobre ${title}...`,
    "Calibrando o nível de dificuldade...",
    "Escrevendo as alternativas...",
    "Revisando as respostas corretas...",
  ];
}

function RotatingMessage({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((prev) => (prev + 1) % messages.length), 1800);
    return () => clearInterval(id);
  }, [messages.length]);
  return <p className="font-mono text-xs text-pixel-subtext">{messages[i]}</p>;
}

// ─── Explanation topics (Skill Builder-style sidebar) ─────────────────────────
// Splits the AI explanation into its "## Heading" sections so they can be
// browsed one at a time from a side nav, instead of one long scroll.

type MarkdownSection = { title: string; body: string };

function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;

  for (const line of markdown.split("\n")) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1]!.trim(), body: `${line}\n` };
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) sections.push(current);

  // ponytail: naive split assumes the AI followed the prompt's "## Heading"
  // structure; falls back to a single section (e.g. old cached explanations).
  return sections.length > 0 ? sections : [{ title: "Explicação", body: markdown }];
}

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
// Reuses the shared Simulado/Sprint question renderer (QuestionOptionsCard)
// instead of a bespoke option-highlighting implementation.

function toCardQuestion(question: TrailQuestion): QuestionCardQuestion {
  const options: Partial<Record<QuestionOption, string>> = {};
  for (const opt of question.options) {
    options[opt.key as QuestionOption] = opt.text;
  }
  const correctOption = question.correctKey as QuestionOption;
  return {
    id: question.id,
    statement: question.statement,
    questionType: "single",
    options,
    correctOption,
    correctOptions: [correctOption],
  };
}

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

      <QuestionOptionsCard
        question={toCardQuestion(question)}
        answer={(selected as QuestionOption) ?? undefined}
        onSelect={(value) => onSelect(Array.isArray(value) ? value[0]! : value)}
        submitted={revealed}
        disabled={revealed}
        footer={
          revealed ? (
            <div
              className={`border-t pt-3 ${isCorrect ? "border-[var(--pixel-accent)]/60" : "border-red-500/40"}`}
            >
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-muted)] mb-1">
                {isCorrect ? "✓ Correto!" : `✗ Incorreto — Resposta: ${question.correctKey}`}
              </p>
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{question.explanation}</p>
            </div>
          ) : undefined
        }
      />

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
  const [markdown, setMarkdown] = useState("");
  const [topicIdx, setTopicIdx] = useState(0);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => splitMarkdownSections(markdown), [markdown]);
  const isLastTopic = topicIdx >= sections.length - 1;

  // Start: load explanation on mount
  useState(() => {
    void (async () => {
      setError(null);
      try {
        const { markdown: md } = await fetchStageExplain(chainId, stage.id);
        setMarkdown(md);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar explicação.");
      } finally {
        setPhase({ tag: "explain" });
      }
    })();
  });

  async function startQuiz() {
    setPhase({ tag: "loading_questions" });
    setAnswers([]);
    setError(null);
    try {
      const { questions } = await fetchStageQuestions(chainId, stage.id);
      setPhase({ tag: "quiz", questions, idx: 0, selected: null, revealed: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar questões.");
      setPhase({ tag: "explain" });
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
    const answered: AnsweredQuestion = { question: phase.questions[phase.idx]!, selected: phase.selected };
    const updatedAnswers = [...answers, answered];
    const isLast = phase.idx >= phase.questions.length - 1;

    if (!isLast) {
      setAnswers(updatedAnswers);
      setPhase({ ...phase, idx: phase.idx + 1, selected: null, revealed: false });
      return;
    }

    // Last question — evaluate
    setAnswers(updatedAnswers);
    const allCorrect = updatedAnswers.every((a) => a.selected === a.question.correctKey);
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
      setPhase({ tag: "quiz_failed" });
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
                        : phase.tag === "review"
                          ? "Revisão da tentativa"
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
              <RotatingMessage messages={EXPLAIN_LOADING_MESSAGES} />
            </div>
          )}

          {/* Explanation — Skill Builder-style: topics on the side, content next to it */}
          {phase.tag === "explain" && markdown && (
            <div className="flex flex-col gap-4 md:flex-row md:h-[65vh]">
              {/* Topic sidebar */}
              <nav className="shrink-0 overflow-y-auto border border-pixel-border bg-pixel-card md:w-56 md:max-h-full">
                <ul className="divide-y divide-pixel-border">
                  {sections.map((section, i) => (
                    <li key={section.title}>
                      <button
                        type="button"
                        onClick={() => setTopicIdx(i)}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left font-mono text-[11px] uppercase transition-colors ${
                          i === topicIdx
                            ? "bg-accent font-bold text-[var(--pixel-bg)]"
                            : i < topicIdx
                              ? "text-[var(--pixel-accent)] hover:bg-[var(--pixel-muted)]/30"
                              : "text-pixel-subtext hover:bg-[var(--pixel-muted)]/30"
                        }`}
                      >
                        <span className="shrink-0 opacity-70">{i < topicIdx ? "✓" : i + 1}</span>
                        <span className="truncate">{section.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Selected topic content */}
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex-1 overflow-y-auto border border-pixel-border bg-pixel-card p-4 sm:p-6">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="mb-3 font-mono text-base uppercase text-primary">{children}</h1>,
                      h2: ({ children }) => (
                        <h2 className="mb-3 mt-5 font-mono text-sm uppercase text-accent">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mb-2 mt-4 font-mono text-xs uppercase text-accent">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-3 font-sans text-base leading-7 text-pixel-subtext">{children}</p>
                      ),
                      li: ({ children }) => (
                        <li className="mb-1.5 ml-4 list-disc font-sans text-base leading-7 text-pixel-subtext">{children}</li>
                      ),
                      ul: ({ children }) => <ul className="mb-3 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-3 list-decimal ml-4 space-y-1">{children}</ol>,
                      strong: ({ children }) => <strong className="font-semibold text-pixel-text">{children}</strong>,
                      code: ({ children }) => (
                        <code className="bg-pixel-border/10 rounded-md px-1 py-0.5 font-mono text-sm text-accent">
                          {children}
                        </code>
                      ),
                      hr: () => <hr className="my-3 border-pixel-border" />,
                    }}
                  >
                    {sections[topicIdx]?.body ?? ""}
                  </ReactMarkdown>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <PixelButton variant="ghost" onClick={onClose}>
                    Voltar
                  </PixelButton>
                  {isLastTopic ? (
                    <PixelButton onClick={() => void startQuiz()}>Estou pronto — Iniciar Quiz</PixelButton>
                  ) : (
                    <PixelButton onClick={() => setTopicIdx((i) => Math.min(i + 1, sections.length - 1))}>
                      Próximo tópico →
                    </PixelButton>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading questions */}
          {phase.tag === "loading_questions" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <RetroIcon />
              <RotatingMessage messages={questionsLoadingMessages(stage.title)} />
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
                  {answers.filter((a) => a.selected === a.question.correctKey).length}/{answers.length} corretas
                </p>
                <p className="mt-1 font-sans text-sm text-pixel-subtext">
                  Você precisa acertar todas as {answers.length} questões para avançar. Revise a explicação e tente
                  novamente!
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <PixelButton onClick={() => setPhase({ tag: "review" })}>Rever tentativa</PixelButton>
                <PixelButton variant="ghost" onClick={() => setPhase({ tag: "explain" })}>
                  Reler explicação
                </PixelButton>
                <PixelButton variant="ghost" onClick={() => void startQuiz()}>
                  Novo quiz
                </PixelButton>
              </div>
            </div>
          )}

          {/* Review of the failed attempt: every question with the user's answer revealed */}
          {phase.tag === "review" && (
            <div className="flex flex-col gap-6">
              {answers.map((a, i) => (
                <QuizCard
                  key={a.question.id}
                  question={a.question}
                  idx={i}
                  total={answers.length}
                  selected={a.selected}
                  revealed
                  onSelect={() => {}}
                  onConfirm={() => {}}
                />
              ))}
              <div className="flex gap-3">
                <PixelButton onClick={() => setPhase({ tag: "quiz_failed" })}>Voltar</PixelButton>
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
