import { StudyExplanationResult } from "@/features/study/types";
import {
  QuestionOption,
  QuestionOptionMapping,
  StudyQuestion,
  StudyQuestionType,
  TaskDifficulty,
  Task,
} from "@/lib/types";

export type StudyServiceItem = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  questionCount?: number;
};

export type StudyAnswerSnapshotPayload = {
  questionId: string;
  statement: string;
  questionType?: StudyQuestionType;
  selectedOption: string;
  selectedOptions?: string[];
  correctOption: string;
  correctOptions?: string[];
  options: Record<string, string>;
  explanations: Record<string, string>;
  explanationSummary?: string;
  optionMapping?: QuestionOptionMapping;
};

export type SaveStudyHistoryPayload = {
  sessionType: "KC" | "SIMULADO";
  title: string;
  certificationCode?: string | null;
  gainedXp: number;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  durationSeconds?: number;
  answersSnapshot: StudyAnswerSnapshotPayload[];
  packId?: string | null;
};

export type QuestHistoryItem = {
  id: string;
  title: string;
  theme: string;
  xp: number;
  tasksCount: number;
  completedAt: string;
  certification: string;
  userName: string;
  sourceLabText?: string | null;
  taskSnapshot?: Task[];
};

export type StudyHistoryItem = {
  id: string;
  sessionType: "KC" | "SIMULADO";
  title: string;
  certificationCode?: string | null;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  gainedXp: number;
  durationSeconds?: number | null;
  completedAt: string;
  answersSnapshot: StudyAnswerSnapshotPayload[];
  packName?: string | null;
  packArtworkUrl?: string | null;
};

export type WeakServiceItem = {
  topic: string;
  serviceCode: string;
  serviceName: string;
  attempts: number;
  errors: number;
  correct: number;
  errorRate: number;
};

export type SimuladoExamGuidePayload = {
  markdown: string;
  preview: string;
  highlights: string[];
  totalChars: number;
};

type StudyExplainPayload = {
  questionId: string;
  selectedOption?: QuestionOption;
  selectedOptions?: QuestionOption[];
  optionMapping?: QuestionOptionMapping;
};

export type NewAchievementPayload = {
  code: string;
  name: string;
  description: string;
  rarity: string;
  imageUrl?: string | null;
};

export type SaveStudyHistoryResult = {
  ok: boolean;
  itemId?: string;
  prevXp?: number;
  newXp?: number;
  newAchievements?: NewAchievementPayload[];
};

export type ReportQuestionReason =
  | "INCORRECT_ANSWER"
  | "UNCLEAR_STATEMENT"
  | "MISSING_CONTEXT"
  | "GRAMMAR_TYPO"
  | "DUPLICATE"
  | "QUALITY_ISSUE"
  | "OTHER";

export type ReportStudyQuestionPayload = {
  questionId: string;
  reason: ReportQuestionReason;
  description?: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function listStudyServices(params?: { withCount?: boolean; difficulty?: string }): Promise<StudyServiceItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.withCount) searchParams.set("withCount", "true");
  if (params?.difficulty) searchParams.set("difficulty", params.difficulty);
  const suffix = searchParams.toString();
  const response = await fetch(`/api/study/services${suffix ? `?${suffix}` : ""}`);
  const data = await parseJson<{ services?: StudyServiceItem[]; error?: string }>(response);
  if (!response.ok || data.error) {
    throw new Error(data.error ?? "Falha ao carregar serviços AWS.");
  }
  return data.services ?? [];
}

export async function createKcQuestions(params: {
  topics: string[];
  difficulty: TaskDifficulty;
  count: number;
}): Promise<StudyQuestion[]> {
  const response = await fetch("/api/study/kc/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await parseJson<{ questions?: StudyQuestion[]; error?: string }>(response);
  if (!response.ok || !data.questions?.length) {
    throw new Error(data.error ?? "Nao foi possivel iniciar o KC.");
  }

  return data.questions;
}

export async function createSimuladoQuestions(params: { count: number; difficulties: TaskDifficulty[] }): Promise<{
  questions: StudyQuestion[];
  certificationCode: string;
  examMinutes?: number;
  examGuide?: SimuladoExamGuidePayload;
}> {
  const response = await fetch("/api/study/simulado/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await parseJson<{
    questions?: StudyQuestion[];
    certificationCode?: string;
    examMinutes?: number;
    examGuide?: SimuladoExamGuidePayload;
    error?: string;
  }>(response);

  if (!response.ok || !data.questions || !data.certificationCode) {
    throw new Error(data.error ?? "Nao foi possivel iniciar o simulado.");
  }

  return {
    questions: data.questions,
    certificationCode: data.certificationCode,
    examMinutes: data.examMinutes,
    examGuide: data.examGuide,
  };
}

export async function createSimuladoQuestionsFromPack(packId: string): Promise<{
  packId: string;
  packName: string;
  questions: StudyQuestion[];
  certificationCode: string;
  examMinutes?: number;
  examGuide?: SimuladoExamGuidePayload;
}> {
  const response = await fetch(`/api/study/simulado/pack-questions?packId=${encodeURIComponent(packId)}`);

  const data = await parseJson<{
    packId?: string;
    packName?: string;
    questions?: StudyQuestion[];
    certificationCode?: string;
    examMinutes?: number;
    examGuide?: SimuladoExamGuidePayload;
    error?: string;
  }>(response);

  if (!response.ok || !data.questions || !data.certificationCode) {
    throw new Error(data.error ?? "Nao foi possivel carregar as questoes do pack.");
  }

  return {
    packId: data.packId ?? packId,
    packName: data.packName ?? "",
    questions: data.questions,
    certificationCode: data.certificationCode,
    examMinutes: data.examMinutes,
    examGuide: data.examGuide,
  };
}

export async function fetchSimuladoExamGuide(): Promise<{
  certificationCode: string;
  examMinutes?: number;
  examGuide: SimuladoExamGuidePayload;
}> {
  const response = await fetch("/api/study/simulado/questions", {
    method: "GET",
  });

  const data = await parseJson<{
    certificationCode?: string;
    examMinutes?: number;
    examGuide?: SimuladoExamGuidePayload;
    error?: string;
  }>(response);

  if (!response.ok || !data.examGuide || !data.certificationCode) {
    throw new Error(data.error ?? "Nao foi possivel carregar o Exam Guide do simulado.");
  }

  return {
    certificationCode: data.certificationCode,
    examMinutes: data.examMinutes,
    examGuide: data.examGuide,
  };
}

export async function createStudyExplanation(payload: StudyExplainPayload): Promise<StudyExplanationResult> {
  const response = await fetch("/api/study/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{ summary?: string; options?: Partial<Record<QuestionOption, string>>; error?: string }>(
    response,
  );

  if (!response.ok || !data.options) {
    throw new Error(data.error ?? "Nao foi possivel gerar explicacao da questao.");
  }

  return {
    summary: data.summary ?? "Resumo indisponivel.",
    options: data.options,
  };
}

export async function saveStudyHistory(payload: SaveStudyHistoryPayload): Promise<SaveStudyHistoryResult> {
  const response = await fetch("/api/study/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { ok: false };
  }

  type HistoryResponse = { item?: { id?: string }; prevXp?: number; newXp?: number; newAchievements?: NewAchievementPayload[] };
  const data = await parseJson<HistoryResponse>(response).catch((): HistoryResponse => ({}));

  return {
    ok: true,
    itemId: typeof data.item?.id === "string" ? data.item.id : undefined,
    prevXp: typeof data.prevXp === "number" ? data.prevXp : undefined,
    newXp: typeof data.newXp === "number" ? data.newXp : undefined,
    newAchievements: Array.isArray(data.newAchievements) ? data.newAchievements : undefined,
  };
}

export async function saveStudyHistoryExplanation(input: {
  historyId: string;
  questionId: string;
  explanationSummary?: string;
  explanations: Partial<Record<QuestionOption, string>>;
}): Promise<void> {
  const response = await fetch(`/api/study/history/${encodeURIComponent(input.historyId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: input.questionId,
      explanationSummary: input.explanationSummary,
      explanations: input.explanations,
    }),
  });

  if (!response.ok) {
    const data = await parseJson<{ error?: string }>(response).catch(() => ({ error: undefined }));
    throw new Error(data.error ?? "Nao foi possivel salvar explicacao no historico.");
  }
}

export async function reportStudyQuestion(payload: ReportStudyQuestionPayload): Promise<void> {
  const response = await fetch("/api/study/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await parseJson<{ error?: string }>(response).catch(() => ({ error: undefined }));
    throw new Error(data.error ?? "Nao foi possivel enviar denuncia da questao.");
  }
}

export async function fetchQuestHistory(): Promise<QuestHistoryItem[]> {
  const response = await fetch("/api/quest-history");
  const data = await parseJson<{ history?: QuestHistoryItem[]; error?: string }>(response);

  if (!response.ok || data.error) {
    throw new Error(data.error ?? "Erro ao carregar historico de labs.");
  }

  return data.history ?? [];
}

export async function fetchStudyHistory(): Promise<StudyHistoryItem[]> {
  const response = await fetch("/api/study/history");
  const data = await parseJson<{ history?: StudyHistoryItem[]; error?: string }>(response);

  if (!response.ok || data.error) {
    throw new Error(data.error ?? "Erro ao carregar historico de estudo.");
  }

  return data.history ?? [];
}

export async function fetchStudyHistoryItemById(historyId: string): Promise<StudyHistoryItem> {
  const normalizedId = historyId.trim();
  if (!normalizedId) {
    throw new Error("ID do historico invalido.");
  }

  const response = await fetch(`/api/study/history/${encodeURIComponent(normalizedId)}`);
  const data = await parseJson<{ item?: StudyHistoryItem; error?: string }>(response);

  if (!response.ok || data.error || !data.item) {
    throw new Error(data.error ?? "Erro ao carregar sessao de estudo.");
  }

  return data.item;
}

export async function fetchWeakServices(params?: { take?: number; sample?: number }): Promise<WeakServiceItem[]> {
  const searchParams = new URLSearchParams();

  if (typeof params?.take === "number") {
    searchParams.set("take", String(params.take));
  }

  if (typeof params?.sample === "number") {
    searchParams.set("sample", String(params.sample));
  }

  const suffix = searchParams.toString();
  const response = await fetch(`/api/study/weak-services${suffix ? `?${suffix}` : ""}`);
  const data = await parseJson<{ weakServices?: WeakServiceItem[]; error?: string }>(response);

  if (!response.ok || data.error) {
    throw new Error(data.error ?? "Erro ao carregar fraquezas por servico.");
  }

  return data.weakServices ?? [];
}

export async function suggestStudyQuestion(params: {
  serviceCode: string;
  serviceName?: string;
  difficulty: string;
}): Promise<void> {
  const response = await fetch("/api/study/question-suggestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = await parseJson<{ error?: string }>(response).catch(() => ({ error: undefined }));
    throw new Error(data.error ?? "Nao foi possivel enviar a sugestao.");
  }
}
