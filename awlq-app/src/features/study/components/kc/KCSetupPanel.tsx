"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { StudyServiceItem } from "@/features/study/services";
import { TaskDifficulty } from "@/lib/types";
import { STUDY_DIFFICULTIES } from "@/features/study/constants";

function maxTopicsForCount(count: number): number {
  return Math.max(1, Math.floor(count / 5));
}

const DIFFICULTY_STYLE: Record<TaskDifficulty, string> = {
  easy: "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10",
  medium: "border-yellow-500 bg-yellow-900/15",
  hard: "border-red-500 bg-red-900/15",
  nightmare: "border-purple-500 bg-purple-900/20",
};

type Props = {
  services: StudyServiceItem[];
  servicesLoading: boolean;
  servicesError: string | null;
  selectedTopics: string[];
  selectedDifficulty: TaskDifficulty;
  questionCount: number;
  searchTopic: string;
  servicesPage: number;
  filteredServices: StudyServiceItem[];
  pagedServices: StudyServiceItem[];
  servicePageCount: number;
  currentServicesPage: number;
  loadingQuestions: boolean;
  flowError: string | null;
  completionMessage: string | null;
  suggestionSent: string | null;
  onSearchTopicChange: (value: string) => void;
  onServicesPageChange: (page: number) => void;
  onToggleTopic: (code: string) => void;
  onDifficultyChange: (d: TaskDifficulty) => void;
  onQuestionCountChange: (n: number) => void;
  onStart: () => void;
  onSuggestQuestion: (service: StudyServiceItem) => void;
};

export function KCSetupPanel({
  servicesLoading,
  servicesError,
  selectedTopics,
  selectedDifficulty,
  questionCount,
  searchTopic,
  filteredServices,
  pagedServices,
  servicePageCount,
  currentServicesPage,
  loadingQuestions,
  flowError,
  completionMessage,
  suggestionSent,
  onSearchTopicChange,
  onServicesPageChange,
  onToggleTopic,
  onDifficultyChange,
  onQuestionCountChange,
  onStart,
  onSuggestQuestion,
}: Props) {
  const maxTopics = maxTopicsForCount(questionCount);

  return (
    <PixelCard className="space-y-4">
      <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Configurar KC</h2>

      {completionMessage && (
        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-accent)]">{completionMessage}</p>
      )}

      {/* Quantidade de questões */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Questoes</p>
          <span className="font-mono text-[10px] text-[var(--pixel-primary)]">{questionCount} questoes</span>
        </div>
        <input
          type="range"
          min={5}
          max={30}
          step={5}
          value={questionCount}
          onChange={(e) => onQuestionCountChange(Number(e.target.value))}
          className="w-full accent-[var(--pixel-primary)]"
        />
        <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
          Com {questionCount} questoes, selecione ate {maxTopics} servico(s).
        </p>
      </div>

      {/* Dificuldade */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Dificuldade</p>
        <div className="flex flex-wrap gap-2">
          {(STUDY_DIFFICULTIES as TaskDifficulty[]).map((difficulty) => {
            const selected = selectedDifficulty === difficulty;
            return (
              <button
                key={difficulty}
                type="button"
                onClick={() => onDifficultyChange(difficulty)}
                className={`border px-3 py-2 font-mono text-[10px] uppercase transition-colors ${
                  selected
                    ? (DIFFICULTY_STYLE[difficulty] ?? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10")
                    : "border-[var(--pixel-border)] bg-[var(--pixel-bg)] hover:bg-[var(--pixel-muted)]"
                }`}
              >
                {difficulty === "nightmare" ? "⚡ Nightmare" : difficulty}
              </button>
            );
          })}
        </div>
        {selectedDifficulty === "nightmare" && (
          <p className="font-[var(--font-body)] text-xs text-purple-400">
            Nightmare: questoes avancadas com XP dobrado. Recomendado para quem ja domina o assunto.
          </p>
        )}
      </div>

      {/* Assuntos com inventário */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
          Assuntos AWS · Selecionados: {selectedTopics.length}/{maxTopics}
        </p>
        {servicesLoading && <p className="font-[var(--font-body)] text-sm">Carregando servicos...</p>}
        {servicesError && <p className="font-[var(--font-body)] text-sm text-red-300">{servicesError}</p>}
        {!servicesLoading && !servicesError && (
          <div className="space-y-3">
            <input
              type="search"
              value={searchTopic}
              onChange={(e) => onSearchTopicChange(e.target.value)}
              placeholder="Buscar por nome ou codigo do servico"
              className="w-full border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] text-sm"
            />

            <div className="grid gap-2 sm:grid-cols-2">
              {pagedServices.map((service) => {
                const selected = selectedTopics.includes(service.code);
                const blockedByLimit = !selected && selectedTopics.length >= maxTopics;
                const count = service.questionCount ?? 0;
                const hasQuestions = count > 0;
                const barMax = Math.max(count, 10);
                const barFill = Math.round((count / barMax) * 8);
                return (
                  <div key={service.id} className="relative">
                    <button
                      type="button"
                      onClick={() => (hasQuestions ? onToggleTopic(service.code) : undefined)}
                      disabled={blockedByLimit || !hasQuestions}
                      className={`w-full border px-3 py-2 text-left font-[var(--font-body)] text-sm ${
                        selected
                          ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10"
                          : hasQuestions
                            ? "border-[var(--pixel-border)] bg-[var(--pixel-bg)]"
                            : "border-[var(--pixel-border)] bg-[var(--pixel-bg)] opacity-50"
                      } ${blockedByLimit ? "cursor-not-allowed opacity-45" : ""}`}
                    >
                      <p className="font-sans text-sm">{service.name}</p>
                      <p className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">{service.code}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="font-mono text-[8px] text-[var(--pixel-subtext)]">
                          {"█".repeat(barFill)}{"░".repeat(8 - barFill)}
                        </span>
                        <span className="font-mono text-[8px] text-[var(--pixel-subtext)]">{count}q</span>
                      </div>
                    </button>
                    {!hasQuestions && (
                      <button
                        type="button"
                        onClick={() => onSuggestQuestion(service)}
                        className="absolute right-1 top-1 border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-0.5 font-mono text-[8px] uppercase hover:bg-[var(--pixel-muted)]"
                      >
                        {suggestionSent === service.code ? "Enviado!" : "Sugerir"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                Pag. {currentServicesPage}/{servicePageCount} · {filteredServices.length} servicos
              </p>
              <div className="flex gap-2">
                <PixelButton
                  variant="ghost"
                  onClick={() => onServicesPageChange(Math.max(1, currentServicesPage - 1))}
                  disabled={currentServicesPage <= 1}
                >
                  Anterior
                </PixelButton>
                <PixelButton
                  variant="ghost"
                  onClick={() => onServicesPageChange(Math.min(servicePageCount, currentServicesPage + 1))}
                  disabled={currentServicesPage >= servicePageCount}
                >
                  Proxima
                </PixelButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {flowError && <p className="font-[var(--font-body)] text-sm text-red-300">{flowError}</p>}

      <div className="flex justify-end">
        <PixelButton onClick={onStart} disabled={loadingQuestions}>
          {loadingQuestions ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
              Gerando KC...
            </span>
          ) : (
            "Iniciar KC"
          )}
        </PixelButton>
      </div>
    </PixelCard>
  );
}
