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
  durationSeconds?: number | null;
  completedAt: string;
  answersSnapshot: StudyAnswerSnapshotPayload[];
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

type StudyExplainPayload = {
  questionId: string;
  selectedOption?: QuestionOption;
  selectedOptions?: QuestionOption[];
  optionMapping?: QuestionOptionMapping;
};

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function listStudyServices(): Promise<StudyServiceItem[]> {
  const response = await fetch("/api/study/services");
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

export async function createSimuladoQuestions(params: {
  count: number;
  difficulties: TaskDifficulty[];
}): Promise<{ questions: StudyQuestion[]; certificationCode: string; examMinutes?: number }> {
  const response = await fetch("/api/study/simulado/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await parseJson<{
    questions?: StudyQuestion[];
    certificationCode?: string;
    examMinutes?: number;
    error?: string;
  }>(response);

  if (!response.ok || !data.questions || !data.certificationCode) {
    throw new Error(data.error ?? "Nao foi possivel iniciar o simulado.");
  }

  return {
    questions: data.questions,
    certificationCode: data.certificationCode,
    examMinutes: data.examMinutes,
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

export async function saveStudyHistory(payload: SaveStudyHistoryPayload): Promise<boolean> {
  const response = await fetch("/api/study/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.ok;
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
