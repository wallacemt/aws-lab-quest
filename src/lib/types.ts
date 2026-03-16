export type Task = {
  id: number;
  title: string;
  mission: string;
  service: string;
  analogy: string;
  steps: string[];
  difficulty?: TaskDifficulty;
  completed?: boolean;
};

export type TaskDifficulty = "easy" | "medium" | "hard";

export type LevelTone = "base" | "base-mid" | "mid" | "mid-top" | "top" | "legendary";

export type Level = {
  name: "Recruta" | "Cadete" | "Explorador" | "Especialista" | "Guardião AWS" | "Lendário";
  min: number;
  max: number;
  next: string;
  tone: LevelTone;
  number: number;
};

export type UserProfile = {
  name: string;
  certification: string;
  certificationPresetCode: string;
  favoriteTheme: string;
  username: string;
};

export type CertificationPreset = {
  id: string;
  code: string;
  name: string;
  description: string;
  examMinutes: number;
  active: boolean;
  displayOrder: number;
};

export type QuestionOption = "A" | "B" | "C" | "D" | "E";

export type QuestionOptionMapping = {
  displayToOriginal: Partial<Record<QuestionOption, QuestionOption>>;
  originalToDisplay: Partial<Record<QuestionOption, QuestionOption>>;
};

export type StudyQuestion = {
  id: string;
  statement: string;
  certificationCode: string;
  topic: string;
  difficulty: TaskDifficulty;
  options: Record<QuestionOption, string>;
  correctOption: QuestionOption;
  explanations: Partial<Record<QuestionOption, string>>;
  optionMapping?: QuestionOptionMapping;
};

export type SimulatedExamSession = {
  id: string;
  startedAt: string;
  endsAt: string;
  certificationCode: string;
  locked: boolean;
  submittedAt?: string;
};

export type ActiveQuest = {
  title: string;
  theme: string;
  sourceLabText?: string;
  tasks: Task[];
  xp: number;
  startedAt: string;
  completed: boolean;
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

export type GenerateQuestInput = {
  theme: string;
  labText: string;
};
