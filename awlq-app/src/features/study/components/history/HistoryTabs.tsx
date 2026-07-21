"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PixelCard } from "@/components/ui/pixel-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestHistoryItem, StudyHistoryItem } from "@/features/study/services";
import { getTaskXpByDifficulty } from "@/lib/levels";
import { normalizeOptionText } from "@/lib/study-option-text";
import { isCorrectAnswer, normalizeQuestionType } from "@/lib/study-answer-utils";
import { QuestionOptionMapping, Task } from "@/lib/types";

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

export type ActiveTab = "LAB" | "KC" | "SPRINT" | "SIMULADO" | "TRILHAS" | "ARENA" | "QUIZ_DIARIO";

export const ACTIVE_TABS: ActiveTab[] = ["LAB", "KC", "SPRINT", "SIMULADO", "TRILHAS", "ARENA", "QUIZ_DIARIO"];

// ponytail: Sprint shares StudySessionType.KC with regular Knowledge Checks (DEF-003) —
// this title prefix is how the sprint route (src/app/api/retention/sprint/route.ts)
// tags its own sessions, reused here to split the two into separate tabs.
const SPRINT_TITLE_PREFIX = "Sprint ";

// Boss battle victories also share StudySessionType.KC (see /api/arena/battle/route.ts) —
// same title-prefix trick as Sprint, so wins get their own Arena tab instead of showing under KC.
const ARENA_TITLE_PREFIX = "Boss Battle: ";

// Daily Quiz also shares StudySessionType.KC (see /api/daily-quiz/route.ts) — same trick.
const DAILY_QUIZ_TITLE_PREFIX = "Quiz Diário — ";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Facil",
  medium: "Media",
  hard: "Dificil",
  nightmare: "Nightmare",
};

/** Placeholder cards shaped like the real history list items while a fetch is in flight. */
function HistoryListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full rounded-none" />
      <Skeleton className="h-16 w-full rounded-none" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <PixelCard key={i} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-2/3 rounded-none" />
              <Skeleton className="h-5 w-12 rounded-none" />
            </div>
            <Skeleton className="h-3 w-1/2 rounded-none" />
            <Skeleton className="h-3 w-1/3 rounded-none" />
          </PixelCard>
        ))}
      </div>
    </div>
  );
}

function normalizeSnapshot(tasks: Task[] | undefined): Task[] {
  if (!tasks || tasks.length === 0) return [];
  return tasks.map((task, index) => ({
    ...task,
    id: typeof task.id === "number" ? task.id : index + 1,
    difficulty: task.difficulty ?? "medium",
    completed: Boolean(task.completed),
    steps: Array.isArray(task.steps) ? task.steps : [],
  }));
}

type Props = {
  labHistory: QuestHistoryItem[];
  studyHistory: StudyHistoryItem[];
  loading?: boolean;
  error?: string | null;
  readOnly?: boolean;
  defaultTab?: ActiveTab;
  initialReviewId?: string;
};

export function HistoryTabs({
  labHistory,
  studyHistory,
  loading,
  error,
  readOnly,
  defaultTab = "LAB",
  initialReviewId,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultTab);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<QuestHistoryItem | null>(null);
  const [selectedStudyItem, setSelectedStudyItem] = useState<StudySessionItem | null>(null);

  const normalizedStudyHistory: StudySessionItem[] = useMemo(
    () =>
      studyHistory.map((item) => ({
        ...item,
        answersSnapshot: Array.isArray(item.answersSnapshot) ? (item.answersSnapshot as StudyAnswerSnapshot[]) : [],
      })),
    [studyHistory],
  );

  // Deep-link support: opens the review modal for a specific session (e.g. right
  // after finishing a Sprint) then strips the query param so back/refresh doesn't reopen it.
  useEffect(() => {
    if (!initialReviewId) return;
    const item = normalizedStudyHistory.find((i) => i.id === initialReviewId);
    if (item) {
      setSelectedStudyItem(item);
      router.replace("/history");
    }
  }, [initialReviewId, normalizedStudyHistory, router]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredLabs = useMemo(() => {
    if (!normalizedSearch) return labHistory;
    return labHistory.filter((item) => {
      const date = new Date(item.completedAt).toLocaleDateString("pt-BR");
      const haystack = `${item.title} ${item.theme} ${item.certification ?? ""} ${item.userName ?? ""} ${date}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [labHistory, normalizedSearch]);

  const filteredStudyHistory = useMemo(() => {
    if (!normalizedSearch) return normalizedStudyHistory;
    return normalizedStudyHistory.filter((item) => {
      const date = new Date(item.completedAt).toLocaleDateString("pt-BR");
      const haystack = `${item.title} ${item.sessionType} ${item.certificationCode ?? ""} ${item.packName ?? ""} ${date}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch, normalizedStudyHistory]);

  const filteredKC = useMemo(
    () =>
      filteredStudyHistory.filter(
        (i) =>
          i.sessionType === "KC" &&
          !i.title.startsWith(SPRINT_TITLE_PREFIX) &&
          !i.title.startsWith(ARENA_TITLE_PREFIX) &&
          !i.title.startsWith(DAILY_QUIZ_TITLE_PREFIX),
      ),
    [filteredStudyHistory],
  );
  const filteredSprint = useMemo(
    () => filteredStudyHistory.filter((i) => i.sessionType === "KC" && i.title.startsWith(SPRINT_TITLE_PREFIX)),
    [filteredStudyHistory],
  );
  const filteredArena = useMemo(
    () => filteredStudyHistory.filter((i) => i.sessionType === "KC" && i.title.startsWith(ARENA_TITLE_PREFIX)),
    [filteredStudyHistory],
  );
  const filteredDailyQuiz = useMemo(
    () => filteredStudyHistory.filter((i) => i.sessionType === "KC" && i.title.startsWith(DAILY_QUIZ_TITLE_PREFIX)),
    [filteredStudyHistory],
  );
  const filteredSimulado = useMemo(() => filteredStudyHistory.filter((i) => i.sessionType === "SIMULADO"), [filteredStudyHistory]);

  const kcCount = normalizedStudyHistory.filter(
    (i) =>
      i.sessionType === "KC" &&
      !i.title.startsWith(SPRINT_TITLE_PREFIX) &&
      !i.title.startsWith(ARENA_TITLE_PREFIX) &&
      !i.title.startsWith(DAILY_QUIZ_TITLE_PREFIX),
  ).length;
  const sprintCount = normalizedStudyHistory.filter((i) => i.sessionType === "KC" && i.title.startsWith(SPRINT_TITLE_PREFIX)).length;
  const arenaCount = normalizedStudyHistory.filter((i) => i.sessionType === "KC" && i.title.startsWith(ARENA_TITLE_PREFIX)).length;
  const dailyQuizCount = normalizedStudyHistory.filter(
    (i) => i.sessionType === "KC" && i.title.startsWith(DAILY_QUIZ_TITLE_PREFIX),
  ).length;
  const simuladoCount = normalizedStudyHistory.filter((i) => i.sessionType === "SIMULADO").length;

  const activeTabCount =
    activeTab === "LAB"
      ? filteredLabs.length
      : activeTab === "KC"
        ? filteredKC.length
        : activeTab === "SPRINT"
          ? filteredSprint.length
          : activeTab === "SIMULADO"
            ? filteredSimulado.length
            : activeTab === "ARENA"
              ? filteredArena.length
              : activeTab === "QUIZ_DIARIO"
                ? filteredDailyQuiz.length
                : 0; // TRILHAS: wired up in a future epic
  const hasAnyResult = activeTabCount > 0;

  const tabs: { id: ActiveTab; label: string; total: number }[] = [
    { id: "LAB", label: "LAB", total: labHistory.length },
    { id: "KC", label: "KC", total: kcCount },
    { id: "SPRINT", label: "Sprint", total: sprintCount },
    { id: "SIMULADO", label: "Simulado", total: simuladoCount },
    { id: "TRILHAS", label: "Trilhas", total: 0 },
    { id: "ARENA", label: "Arena", total: arenaCount },
    { id: "QUIZ_DIARIO", label: "Quiz Diario", total: dailyQuizCount },
  ];

  const tabStripRef = useRef<HTMLDivElement>(null);
  const scrollTabs = (direction: -1 | 1) => tabStripRef.current?.scrollBy({ left: direction * 160, behavior: "smooth" });

  const hasData = labHistory.length > 0 || normalizedStudyHistory.length > 0;

  return (
    <div className="space-y-4">
      {loading && <HistoryListSkeleton />}

      {error && (
        <PixelCard className="border-red-500 bg-red-900/20">
          <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
        </PixelCard>
      )}

      {!loading && !error && !hasData && (
        <PixelCard className="py-8 text-center">
          <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Nenhum historico encontrado.</p>
        </PixelCard>
      )}

      {!loading && !error && hasData && (
        <>
          <div className="flex items-stretch gap-1">
            <button
              type="button"
              onClick={() => scrollTabs(-1)}
              aria-label="Abas anteriores"
              className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 font-mono text-xs text-[var(--pixel-subtext)] hover:bg-[var(--pixel-muted)]"
            >
              ‹
            </button>
            <div ref={tabStripRef} className="flex flex-1 gap-0 overflow-x-auto border-2 border-[var(--pixel-border)] scroll-smooth">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 grow basis-28 px-4 py-2 font-mono text-[10px] uppercase transition-colors ${
                    activeTab === tab.id
                      ? "bg-[var(--pixel-primary)] text-[var(--pixel-bg)]"
                      : "bg-[var(--pixel-card)] text-[var(--pixel-subtext)] hover:bg-[var(--pixel-muted)]"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1 opacity-70">({tab.total})</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollTabs(1)}
              aria-label="Próximas abas"
              className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 font-mono text-xs text-[var(--pixel-subtext)] hover:bg-[var(--pixel-muted)]"
            >
              ›
            </button>
          </div>

          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Busca ({activeTab})</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por titulo, tema, certificacao ou data"
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

          {search && !hasAnyResult && (
            <PixelCard className="py-8 text-center">
              <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
                Nenhum resultado para &quot;{search}&quot; em {activeTab}.
              </p>
            </PixelCard>
          )}

          {!search && activeTabCount === 0 && (
            <PixelCard className="py-8 text-center">
              <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Nenhum registro em {activeTab} ainda.</p>
            </PixelCard>
          )}

          {activeTab === "LAB" && filteredLabs.length > 0 && (
            <ScrollArea className="h-92 w-full rounded-md border border-pixel-border">
              <div className="flex flex-col gap-3 p-4">
                {filteredLabs.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className="text-left">
                    <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[var(--pixel-primary)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-body)] text-base">{item.title}</p>
                          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Tema: {item.theme}</p>
                        </div>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">
                          +{item.xp} XP
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                        <span className="font-[var(--font-body)]">{item.tasksCount} tarefas</span>
                        {item.certification && <span className="font-[var(--font-body)]">· {item.certification}</span>}
                        <span className="font-[var(--font-body)]">· {new Date(item.completedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="font-mono text-[9px] uppercase text-[var(--pixel-primary)]">Clique para revisar</p>
                    </PixelCard>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {activeTab === "KC" && filteredKC.length > 0 && (
            <ScrollArea className="h-92 w-full rounded-md border border-pixel-border">
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                {filteredKC.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedStudyItem(item as StudySessionItem)} className="text-left">
                    <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[var(--pixel-accent)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-body)] text-base">{item.title}</p>
                          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{item.certificationCode ?? "Certificacao nao definida"}</p>
                        </div>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-accent)]">{item.scorePercent}%</span>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">+{item.gainedXp} XP</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                        <span className="font-[var(--font-body)]">{item.correctAnswers}/{item.totalQuestions} corretas</span>
                        <span className="font-[var(--font-body)]">· {new Date(item.completedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="font-mono text-[9px] uppercase text-[var(--pixel-accent)]">Clique para revisar respostas</p>
                    </PixelCard>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {activeTab === "SPRINT" && filteredSprint.length > 0 && (
            <ScrollArea className="h-92 w-full rounded-md border border-pixel-border">
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                {filteredSprint.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedStudyItem(item as StudySessionItem)} className="text-left">
                    <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[var(--pixel-accent)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-body)] text-base">{item.title}</p>
                          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{item.certificationCode ?? "Certificacao nao definida"}</p>
                        </div>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-accent)]">{item.scorePercent}%</span>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">+{item.gainedXp} XP</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                        <span className="font-[var(--font-body)]">{item.correctAnswers}/{item.totalQuestions} corretas</span>
                        <span className="font-[var(--font-body)]">· {new Date(item.completedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="font-mono text-[9px] uppercase text-[var(--pixel-accent)]">Clique para revisar respostas</p>
                    </PixelCard>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {activeTab === "ARENA" && filteredArena.length > 0 && (
            <ScrollArea className="h-92 w-full rounded-md border border-pixel-border">
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                {filteredArena.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedStudyItem(item as StudySessionItem)} className="text-left">
                    <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[var(--pixel-primary)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-body)] text-base">{item.title}</p>
                        </div>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-accent)]">{item.scorePercent}%</span>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">+{item.gainedXp} XP</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                        <span className="font-[var(--font-body)]">{item.correctAnswers}/{item.totalQuestions} corretas</span>
                        <span className="font-[var(--font-body)]">· {new Date(item.completedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="font-mono text-[9px] uppercase text-[var(--pixel-primary)]">Clique para revisar respostas</p>
                    </PixelCard>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {activeTab === "QUIZ_DIARIO" && filteredDailyQuiz.length > 0 && (
            <ScrollArea className="h-92 w-full rounded-md border border-pixel-border">
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                {filteredDailyQuiz.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedStudyItem(item as StudySessionItem)} className="text-left">
                    <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[#f97316]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-body)] text-base">{item.title}</p>
                        </div>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-accent)]">{item.scorePercent}%</span>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">+{item.gainedXp} XP</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                        <span className="font-[var(--font-body)]">{item.correctAnswers}/{item.totalQuestions} corretas</span>
                        <span className="font-[var(--font-body)]">· {new Date(item.completedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="font-mono text-[9px] uppercase text-[#f97316]">Clique para revisar respostas</p>
                    </PixelCard>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {activeTab === "SIMULADO" && filteredSimulado.length > 0 && (
            <ScrollArea className="h-92 w-full rounded-md border border-pixel-border">
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                {filteredSimulado.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!readOnly) router.push(`/simulado/historico/${item.id}`);
                    }}
                    className={`text-left ${readOnly ? "cursor-default" : ""}`}
                  >
                    <PixelCard className="space-y-2 transition-transform hover:-translate-y-[1px] hover:border-[var(--pixel-accent)]">
                      <div className="relative mx-auto h-44 w-44 overflow-hidden border-2 border-[var(--pixel-border)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.packArtworkUrl ?? "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/cert-badges/527007c2-c79f-4240-8a20-4b502c2f5b04.png"}
                          alt={item.packName ?? item.title}
                          className="h-full w-full object-cover"
                        />
                        {item.packName && (
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 font-mono text-[9px] uppercase text-white">
                            {item.packName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-body)] text-base">{item.packName ?? item.title}</p>
                          <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{item.certificationCode ?? "Certificacao nao definida"}</p>
                        </div>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-accent)]">{item.scorePercent}%</span>
                        <span className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">+{item.gainedXp} XP</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--pixel-subtext)]">
                        <span className="font-[var(--font-body)]">{item.correctAnswers}/{item.totalQuestions} corretas</span>
                        <span className="font-[var(--font-body)]">· {new Date(item.completedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </PixelCard>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </>
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
              <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">+{selectedItem.xp} XP</span>
              <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">{selectedItem.tasksCount} tarefas</span>
              {selectedItem.certification && <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">{selectedItem.certification}</span>}
            </div>
            {selectedItem.sourceLabText && (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Texto base do lab</p>
                <div className="max-h-48 overflow-auto border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                  <p className="whitespace-pre-wrap font-[var(--font-body)] text-sm text-[var(--pixel-text)]">{selectedItem.sourceLabText}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Tarefas realizadas</p>
              {normalizeSnapshot(selectedItem.taskSnapshot).length === 0 ? (
                <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                  <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Lab salvo antes do snapshot de tarefas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {normalizeSnapshot(selectedItem.taskSnapshot).map((task, index) => {
                    const difficulty = task.difficulty ?? "medium";
                    return (
                      <div key={`${task.id}-${index}`} className="space-y-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-[var(--font-body)] text-sm">{index + 1}. {task.title}</p>
                            <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{task.mission}</p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-mono text-[8px] uppercase">{DIFFICULTY_LABEL[difficulty]}</span>
                            <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-mono text-[8px] uppercase">+{getTaskXpByDifficulty(difficulty)} XP</span>
                            <span className="border border-[var(--pixel-border)] px-2 py-0.5 font-mono text-[8px] uppercase">{task.completed ? "Concluida" : "Pendente"}</span>
                          </div>
                        </div>
                        {task.steps.length > 0 && (
                          <ul className="space-y-1">
                            {task.steps.map((step) => (
                              <li key={step} className="font-[var(--font-body)] text-xs text-[var(--pixel-text)]">- {step}</li>
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
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Revisao {selectedStudyItem.sessionType}</p>
                <h2 className="mt-1 font-[var(--font-body)] text-xl">{selectedStudyItem.title}</h2>
                <p className="mt-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                  {selectedStudyItem.certificationCode ?? "Certificacao nao definida"} · {new Date(selectedStudyItem.completedAt).toLocaleString("pt-BR")}
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
              <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">Score {selectedStudyItem.scorePercent}%</span>
              <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)]">+{selectedStudyItem.gainedXp} XP</span>
              <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">{selectedStudyItem.correctAnswers}/{selectedStudyItem.totalQuestions} corretas</span>
              {selectedStudyItem.durationSeconds != null && (
                <span className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-2 py-1">{Math.floor(selectedStudyItem.durationSeconds / 60)}m {selectedStudyItem.durationSeconds % 60}s</span>
              )}
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Revisao de questoes</p>
              {selectedStudyItem.answersSnapshot.length === 0 ? (
                <div className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                  <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Sessao sem snapshot de respostas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudyItem.answersSnapshot.map((answer, index) => {
                    const questionType = normalizeQuestionType(answer.questionType);
                    const selectedLabels = Array.isArray(answer.selectedOptions) && answer.selectedOptions.length > 0 ? answer.selectedOptions : [answer.selectedOption];
                    const correctLabels = Array.isArray(answer.correctOptions) && answer.correctOptions.length > 0 ? answer.correctOptions : [answer.correctOption];
                    const renderedOptions = Object.entries(answer.options ?? {}).map(([opt, text]) => ({ option: opt, text: normalizeOptionText(text) })).filter((e) => e.text.length > 0);
                    const renderableSet = new Set(renderedOptions.map((e) => e.option));
                    const selectedVisible = selectedLabels.filter((l) => renderableSet.has(l));
                    const correctVisible = correctLabels.filter((l) => renderableSet.has(l));
                    return (
                      <div key={`${answer.questionId}-${index}`} className="space-y-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3">
                        <p className="font-[var(--font-body)] text-sm">{index + 1}. {answer.statement}</p>
                        <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                          {questionType === "multi" ? "Multipla escolha · " : ""}
                          Sua resposta: {selectedVisible.length > 0 ? selectedVisible.join(", ") : selectedLabels.join(", ")} · Correta: {correctVisible.length > 0 ? correctVisible.join(", ") : correctLabels.join(", ")}
                        </p>
                        <div className="space-y-1">
                          {renderedOptions.map(({ option, text }) => (
                            <div
                              key={`${answer.questionId}-${option}`}
                              className={`border-2 px-2 py-2 ${
                                correctVisible.includes(option)
                                  ? "border-[#2ecc71] bg-green-900/25"
                                  : selectedVisible.includes(option) && !correctVisible.includes(option)
                                    ? "border-[#e74c3c] bg-red-900/25"
                                    : "border-[var(--pixel-border)] bg-[var(--pixel-card)]"
                              }`}
                            >
                              <p className="font-[var(--font-body)] text-xs">
                                {option}) {text}
                                {correctVisible.includes(option) ? " · correta" : ""}
                                {selectedVisible.includes(option) ? " · sua resposta" : ""}
                              </p>
                              <p className="mt-1 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{answer.explanations?.[option] ?? "Sem explicacao."}</p>
                            </div>
                          ))}
                        </div>
                        <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                          {isCorrectAnswer({ questionType, selectedOption: answer.selectedOption, selectedOptions: answer.selectedOptions, correctOption: answer.correctOption, correctOptions: answer.correctOptions }) ? "Resultado: correta" : "Resultado: incorreta"}
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
    </div>
  );
}
