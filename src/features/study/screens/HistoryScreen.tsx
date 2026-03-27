"use client";

import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import { fetchQuestHistory, fetchStudyHistory, QuestHistoryItem, StudyHistoryItem } from "@/features/study/services";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { normalizeOptionText } from "@/lib/study-option-text";
import { isCorrectAnswer, normalizeQuestionType } from "@/lib/study-answer-utils";
import { QuestionOptionMapping, Task } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";

type HistoryItem = QuestHistoryItem;

type StudyAnswerSnapshot = {
  questionId: string;
  statement: string;
  questionType?: "single" | "multi";
  selectedOption: string;
  selectedOptions?: string[];
  correctOption: string;
  correctOptions?: string[];
  options: Record<string, string>;
  explanations: Record<string, string>;
  optionMapping?: QuestionOptionMapping;
};

type StudySessionItem = Omit<StudyHistoryItem, "answersSnapshot"> & { answersSnapshot: StudyAnswerSnapshot[] };

const DIFFICULTY_LABEL: Record<"easy" | "medium" | "hard", string> = {
  easy: "Facil",
  medium: "Media",
  hard: "Dificil",
};

function normalizeSnapshot(tasks: Task[] | undefined): Task[] {
  if (!tasks || tasks.length === 0) {
    return [];
  }

  return tasks.map((task, index) => ({
    ...task,
    id: typeof task.id === "number" ? task.id : index + 1,
    difficulty: task.difficulty ?? "medium",
    completed: Boolean(task.completed),
    steps: Array.isArray(task.steps) ? task.steps : [],
  }));
}

export function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [studyHistory, setStudyHistory] = useState<StudySessionItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [selectedStudyItem, setSelectedStudyItem] = useState<StudySessionItem | null>(null);

  useEffect(() => {
    Promise.all([fetchQuestHistory(), fetchStudyHistory()])
      .then(([labsHistory, studyHistoryItems]) => {
        setHistory(labsHistory);
        setStudyHistory(
          studyHistoryItems.map((item) => ({
            ...item,
            answersSnapshot: Array.isArray(item.answersSnapshot) ? (item.answersSnapshot as StudyAnswerSnapshot[]) : [],
          })),
        );
      })
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : "Erro ao carregar histórico."),
      )
      .finally(() => setLoading(false));
  }, []);

  const totalXp = history.reduce((sum, item) => sum + item.xp, 0);
  const normalizedSearch = search.trim().toLowerCase();

  const filteredLabs = useMemo(() => {
    if (!normalizedSearch) {
      return history;
    }

    return history.filter((item) => {
      const date = new Date(item.completedAt).toLocaleDateString("pt-BR");
      const haystack =
        `${item.title} ${item.theme} ${item.certification ?? ""} ${item.userName ?? ""} ${date}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [history, normalizedSearch]);

  const filteredStudyHistory = useMemo(() => {
    if (!normalizedSearch) {
      return studyHistory;
    }

    return studyHistory.filter((item) => {
      const date = new Date(item.completedAt).toLocaleDateString("pt-BR");
      const haystack = `${item.title} ${item.sessionType} ${item.certificationCode ?? ""} ${date}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch, studyHistory]);

  const filteredLabsXp = filteredLabs.reduce((sum, item) => sum + item.xp, 0);
  const hasAnyResult = filteredLabs.length > 0 || filteredStudyHistory.length > 0;

  return (
    <AppLayout>
      <main className="mx-auto  w-fit max-w-4xl space-y-6 px-2 py-4 xl:px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Histórico</h1>
            <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Labs finalizados e sessoes de estudo (KC e Simulado)
            </p>
          </div>
          {(history.length > 0 || studyHistory.length > 0) && (
            <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2">
              <span className="font-mono text-[10px] uppercase">
                {filteredLabs.length}/{history.length} labs · {filteredStudyHistory.length}/{studyHistory.length}{" "}
                estudos · {filteredLabsXp}/{totalXp} XP
              </span>
            </div>
          )}
        </div>

        {!loading && !error && (history.length > 0 || studyHistory.length > 0) && (
          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
              Busca no historico (LAB, KC e Simulado)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por titulo, tema, certificacao, tipo ou data"
                className="min-w-[240px] flex-1 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-mono text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
                >
                  Limpar
                </button>
              )}
            </div>
          </PixelCard>
        )}

        {loading && (
          <PixelCard>
            <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
          </PixelCard>
        )}

        {error && (
          <PixelCard className="border-red-500 bg-red-900/20">
            <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
          </PixelCard>
        )}

        {!loading && !error && history.length === 0 && studyHistory.length === 0 && (
          <PixelCard className="py-12 text-center">
            <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Nenhum registro encontrado ainda.</p>
            <p className="mt-3 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Complete um lab, KC ou simulado para aparecer no historico.
            </p>
          </PixelCard>
        )}

        {!loading && !error && (history.length > 0 || studyHistory.length > 0) && !hasAnyResult && (
          <PixelCard className="py-8 text-center">
            <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
              Nenhum resultado para &quot;{search}&quot;.
            </p>
            <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Tente outro termo, como nome do lab, tipo da sessao (KC/SIMULADO) ou certificacao.
            </p>
          </PixelCard>
        )}

        {!loading && filteredLabs.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Labs</h2>
            <ScrollArea className="h-72 w-full rounded-md  border border-pixel-border">
              <div className="flex flex-col p-4 gap-3 ">
                {filteredLabs.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className="text-left">
                    <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[var(--pixel-primary)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-body)] text-base">{item.title}</p>
                          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                            Tema: {item.theme}
                          </p>
                        </div>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">
                          +{item.xp} XP
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                        <span className="font-[var(--font-body)]">{item.tasksCount} tarefas</span>
                        {item.certification && <span className="font-[var(--font-body)]">· {item.certification}</span>}
                        <span className="font-[var(--font-body)]">
                          · {new Date(item.completedAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="font-mono text-[9px] uppercase text-[var(--pixel-primary)]">
                        Clique para revisar o que foi realizado
                      </p>
                    </PixelCard>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {!loading && filteredStudyHistory.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">KC e Simulados</h2>
            <ScrollArea className="h-72 w-full rounded-md  border border-pixel-border">
              <div className="grid gap-3 grid-cols-1 p-4 sm:grid-cols-2">
                {filteredStudyHistory.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedStudyItem(item)} className="text-left">
                    <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[var(--pixel-accent)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-body)] text-base">{item.title}</p>
                          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                            {item.sessionType} · {item.certificationCode ?? "Certificacao nao definida"}
                          </p>
                        </div>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-accent)]">
                          {item.scorePercent}%
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                        <span className="font-[var(--font-body)]">
                          {item.correctAnswers}/{item.totalQuestions} corretas
                        </span>
                        <span className="font-[var(--font-body)]">
                          · {new Date(item.completedAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="font-mono text-[9px] uppercase text-[var(--pixel-accent)]">
                        Clique para revisar respostas e explicacoes
                      </p>
                    </PixelCard>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {selectedItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
            <PixelCard className="max-h-[90vh] w-full max-w-3xl overflow-y-auto space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Revisao do lab</p>
                  <h2 className="mt-1 font-[var(--font-body)] text-xl">{selectedItem.title}</h2>
                  <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                    Tema: {selectedItem.theme} · {new Date(selectedItem.completedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-mono text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
                >
                  Fechar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                  +{selectedItem.xp} XP
                </span>
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                  {selectedItem.tasksCount} tarefas
                </span>
                {selectedItem.certification && (
                  <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                    {selectedItem.certification}
                  </span>
                )}
              </div>

              {selectedItem.sourceLabText && (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Texto base do lab</p>
                  <div className="max-h-48 overflow-auto border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                    <p className="whitespace-pre-wrap font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
                      {selectedItem.sourceLabText}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Tarefas realizadas</p>
                {normalizeSnapshot(selectedItem.taskSnapshot).length === 0 ? (
                  <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                    <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                      Este lab foi salvo antes da funcionalidade de snapshot de tarefas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {normalizeSnapshot(selectedItem.taskSnapshot).map((task, index) => {
                      const difficulty = task.difficulty ?? "medium";
                      return (
                        <div
                          key={`${task.id}-${index}`}
                          className="space-y-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-[var(--font-body)] text-sm">
                                {index + 1}. {task.title}
                              </p>
                              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                {task.mission}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-mono text-[8px] uppercase">
                                {DIFFICULTY_LABEL[difficulty]}
                              </span>
                              <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-mono text-[8px] uppercase">
                                +{getTaskXpByDifficulty(difficulty)} XP
                              </span>
                              <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-mono text-[8px] uppercase">
                                {task.completed ? "Concluida" : "Pendente"}
                              </span>
                            </div>
                          </div>
                          {task.steps.length > 0 && (
                            <ul className="space-y-1">
                              {task.steps.map((step) => (
                                <li key={step} className="font-[var(--font-body)] text-xs text-[var(--pixel-text)]">
                                  - {step}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </PixelCard>
          </div>
        )}

        {selectedStudyItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
            <PixelCard className="max-h-[90vh] w-full max-w-3xl overflow-y-auto space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">
                    Revisao {selectedStudyItem.sessionType}
                  </p>
                  <h2 className="mt-1 font-[var(--font-body)] text-xl">{selectedStudyItem.title}</h2>
                  <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                    {selectedStudyItem.certificationCode ?? "Certificacao nao definida"} ·{" "}
                    {new Date(selectedStudyItem.completedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudyItem(null)}
                  className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-mono text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
                >
                  Fechar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                  Score {selectedStudyItem.scorePercent}%
                </span>
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                  {selectedStudyItem.correctAnswers}/{selectedStudyItem.totalQuestions} corretas
                </span>
                {selectedStudyItem.durationSeconds != null && (
                  <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">
                    {Math.floor(selectedStudyItem.durationSeconds / 60)}m {selectedStudyItem.durationSeconds % 60}s
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Revisao de questoes</p>

                {selectedStudyItem.answersSnapshot.length === 0 ? (
                  <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                    <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                      Sessao sem snapshot detalhado de respostas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStudyItem.answersSnapshot.map((item, index) => {
                      const questionType = normalizeQuestionType(item.questionType);
                      const selectedLabels =
                        Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0
                          ? item.selectedOptions
                          : [item.selectedOption];
                      const correctLabels =
                        Array.isArray(item.correctOptions) && item.correctOptions.length > 0
                          ? item.correctOptions
                          : [item.correctOption];
                      const renderedOptions = Object.entries(item.options)
                        .map(([option, optionText]) => ({
                          option,
                          text: normalizeOptionText(optionText),
                        }))
                        .filter((entry) => entry.text.length > 0);
                      const renderableOptionLabels = new Set(renderedOptions.map((entry) => entry.option));
                      const selectedVisibleLabels = selectedLabels.filter((label) => renderableOptionLabels.has(label));
                      const correctVisibleLabels = correctLabels.filter((label) => renderableOptionLabels.has(label));
                      const selectedLabel =
                        selectedVisibleLabels.length > 0 ? selectedVisibleLabels.join(", ") : selectedLabels.join(", ");
                      const correctLabel =
                        correctVisibleLabels.length > 0 ? correctVisibleLabels.join(", ") : correctLabels.join(", ");

                      return (
                        <div
                          key={`${item.questionId}-${index}`}
                          className="space-y-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3"
                        >
                          <p className="font-[var(--font-body)] text-sm">
                            {index + 1}. {item.statement}
                          </p>
                          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                            {questionType === "multi" ? "Tipo: multipla escolha · " : ""}
                            Sua resposta: {selectedLabel} · Correta: {correctLabel}
                          </p>
                          <div className="space-y-1">
                            {renderedOptions.map(({ option, text }) => (
                              <div
                                key={`${item.questionId}-${option}`}
                                className={`border-2 px-2 py-2 ${
                                  correctVisibleLabels.includes(option)
                                    ? "border-[#2ecc71] bg-green-900/25"
                                    : selectedVisibleLabels.includes(option) && !correctVisibleLabels.includes(option)
                                      ? "border-[#e74c3c] bg-red-900/25"
                                      : "border-[var(--pixel-border)] bg-[var(--pixel-card)]"
                                }`}
                              >
                                <p className="font-[var(--font-body)] text-xs">
                                  {option}) {text}
                                  {correctVisibleLabels.includes(option) ? " · correta" : ""}
                                  {selectedVisibleLabels.includes(option) ? " · sua resposta" : ""}
                                </p>
                                <p className="mt-1 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                                  {item.explanations[option] ?? "Sem explicacao adicional."}
                                </p>
                              </div>
                            ))}
                          </div>
                          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                            {isCorrectAnswer({
                              questionType,
                              selectedOption: item.selectedOption,
                              selectedOptions: item.selectedOptions,
                              correctOption: item.correctOption,
                              correctOptions: item.correctOptions,
                            })
                              ? "Resultado: correta"
                              : "Resultado: incorreta"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </PixelCard>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
