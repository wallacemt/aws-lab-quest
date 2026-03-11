export type Task = {
  id: number;
  title: string;
  mission: string;
  service: string;
  analogy: string;
  steps: string[];
  completed?: boolean;
};

export type Level = {
  name: "Iniciante" | "Explorador" | "AWS Hero";
  min: number;
  max: number;
  next: string;
  tone: "base" | "mid" | "top";
};

export type UserProfile = {
  name: string;
  certification: string;
  favoriteTheme: string;
};

export type ActiveQuest = {
  title: string;
  theme: string;
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
};

export type GenerateQuestInput = {
  theme: string;
  labText: string;
};
