export const STORAGE_KEYS = {
  user: "awlq_user",
  activeQuest: "awlq_activeQuest",
  history: "awlq_history",
  draftQuest: "awlq_draft_quest",
  activeSimulatedExam: "awlq_active_simulated_exam",
  simuladoDraft: "awlq_simulado_draft",
  kcAttempts: "awlq_kc_attempts",
  simuladoRulesConsent: "awlq_simulado_rules_consent",
  simuladoPacksView: "awlq_simulado_packs_view",
  historyActiveTab: "awlq_history_active_tab",
  adminMode: "awlq_admin_mode",
} as const;

export function safeLocalStorageGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeLocalStorageSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function safeLocalStorageRemove(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}
