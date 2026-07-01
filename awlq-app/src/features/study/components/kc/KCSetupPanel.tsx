"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { StudyServiceItem, WeakServiceItem } from "@/features/study/services";

function maxTopicsForCount(count: number): number {
  return Math.max(1, Math.floor(count / 5));
}

type Props = {
  /** Current wizard step: 1 = quantity, 2 = services, 3 = summary + start */
  activeStep: 1 | 2 | 3;
  services: StudyServiceItem[];
  servicesLoading: boolean;
  servicesError: string | null;
  selectedTopics: string[];
  questionCount: number;
  searchTopic: string;
  filteredServices: StudyServiceItem[];
  pagedServices: StudyServiceItem[];
  servicePageCount: number;
  currentServicesPage: number;
  loadingQuestions: boolean;
  flowError: string | null;
  completionMessage: string | null;
  suggestionSent: string | null;
  weakServices: WeakServiceItem[];
  onSearchTopicChange: (value: string) => void;
  onServicesPageChange: (page: number) => void;
  onToggleTopic: (code: string) => void;
  onQuestionCountChange: (n: number) => void;
  onStart: () => void;
  onSuggestQuestion: (service: StudyServiceItem) => void;
  onStepNext: () => void;
  onStepBack: () => void;
};

export function KCSetupPanel({
  activeStep,
  servicesLoading,
  servicesError,
  selectedTopics,
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
  weakServices,
  onSearchTopicChange,
  onServicesPageChange,
  onToggleTopic,
  onQuestionCountChange,
  onStart,
  onSuggestQuestion,
  onStepNext,
  onStepBack,
}: Props) {
  const maxTopics = maxTopicsForCount(questionCount);

  return (
    <PixelCard className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((step) => (
          <span
            key={step}
            className={`font-mono text-[10px] uppercase ${
              activeStep === step
                ? "text-[var(--pixel-primary)]"
                : activeStep > step
                  ? "text-[var(--pixel-subtext)]"
                  : "text-[var(--pixel-border)]"
            }`}
          >
            {step === 1 ? "1. Quantidade" : step === 2 ? "2. Servicos" : "3. Resumo"}
            {step < 3 && <span className="ml-2 text-[var(--pixel-border)]">›</span>}
          </span>
        ))}
      </div>

      {completionMessage && (
        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-accent)]">{completionMessage}</p>
      )}

      {/* ── Step 1: Quantity ─────────────────────────────────────── */}
      {activeStep === 1 && (
        <div className="space-y-4">
          <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Quantas questoes?</h2>

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
              Com {questionCount} questoes, voce pode selecionar ate {maxTopics} servico(s).
            </p>
          </div>

          {/* Gap preview: inform the user which areas need attention before they pick services */}
          {weakServices.length > 0 && (
            <div className="space-y-1 border border-[var(--pixel-accent)]/30 p-3">
              <p className="font-mono text-[9px] uppercase text-[var(--pixel-accent)]">Gaps identificados</p>
              {weakServices.slice(0, 3).map((item) => (
                <p key={`${item.serviceCode}-${item.topic}`} className="font-mono text-[10px] text-[var(--pixel-text)]">
                  {item.serviceName || item.topic}
                  <span className="ml-2 text-red-400">{item.errorRate}% erro</span>
                </p>
              ))}
              <p className="font-[var(--font-body)] text-[10px] text-[var(--pixel-subtext)]">
                Questoes de gap serao selecionadas com maior dificuldade automaticamente.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <PixelButton onClick={onStepNext}>
              Proximo
            </PixelButton>
          </div>
        </div>
      )}

      {/* ── Step 2: Services ─────────────────────────────────────── */}
      {activeStep === 2 && (
        <div className="space-y-4">
          <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Quais servicos?</h2>
          <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
            Selecionados: {selectedTopics.length}/{maxTopics}
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

          {flowError && <p className="font-[var(--font-body)] text-sm text-red-300">{flowError}</p>}

          <div className="flex justify-between">
            <PixelButton variant="ghost" onClick={onStepBack}>
              Voltar
            </PixelButton>
            <PixelButton onClick={onStepNext} disabled={selectedTopics.length === 0}>
              Proximo
            </PixelButton>
          </div>
        </div>
      )}

      {/* ── Step 3: Summary + Start ───────────────────────────────── */}
      {activeStep === 3 && (
        <div className="space-y-4">
          <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Resumo</h2>

          <div className="space-y-2 border border-[var(--pixel-border)] p-3">
            <div className="flex justify-between">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Questoes</p>
              <p className="font-mono text-[10px] text-[var(--pixel-text)]">{questionCount}</p>
            </div>
            <div className="flex justify-between">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Servicos</p>
              <p className="font-mono text-[10px] text-[var(--pixel-text)]">{selectedTopics.join(", ")}</p>
            </div>
            <div className="flex justify-between">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Dificuldade</p>
              <p className="font-mono text-[10px] text-[var(--pixel-text)]">Automatica (baseada em gaps)</p>
            </div>
          </div>

          {flowError && <p className="font-[var(--font-body)] text-sm text-red-300">{flowError}</p>}

          <div className="flex justify-between">
            <PixelButton variant="ghost" onClick={onStepBack}>
              Voltar
            </PixelButton>
            <PixelButton onClick={onStart} disabled={loadingQuestions}>
              {loadingQuestions ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                  Preparando...
                </span>
              ) : (
                "Iniciar KC"
              )}
            </PixelButton>
          </div>
        </div>
      )}
    </PixelCard>
  );
}
