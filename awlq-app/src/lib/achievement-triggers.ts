export type TriggerType =
  | "LAB_COUNT"
  | "SESSION_COUNT"
  | "SESSION_SCORE_COUNT"
  | "XP_TOTAL"
  | "STREAK_DAYS"
  | "TOTAL_SESSIONS"
  | "CERT_COUNT"
  | "XP_AND_SESSION_SCORE_COMBO"
  | "ARENA_VICTORY_COUNT"
  | "FLASHCARD_REVIEW_COUNT"
  | "FLASHCARD_REVIEW_STREAK_DAYS"
  | "MENTOR_CONSULTED"
  | "GAP_CLEARED_COUNT"
  | "SPRINT_COUNT"
  | "TRAIL_STAGE_COUNT"
  | "TRAIL_CHAIN_COMPLETED_COUNT"
  | "LIBRARY_ACCESS_COUNT"
  | "WEEKLY_CHALLENGE_WINS_COUNT";

export const TRIGGER_TYPES: TriggerType[] = [
  "LAB_COUNT",
  "SESSION_COUNT",
  "SESSION_SCORE_COUNT",
  "XP_TOTAL",
  "STREAK_DAYS",
  "TOTAL_SESSIONS",
  "CERT_COUNT",
  "XP_AND_SESSION_SCORE_COMBO",
  "ARENA_VICTORY_COUNT",
  "FLASHCARD_REVIEW_COUNT",
  "FLASHCARD_REVIEW_STREAK_DAYS",
  "MENTOR_CONSULTED",
  "GAP_CLEARED_COUNT",
  "SPRINT_COUNT",
  "TRAIL_STAGE_COUNT",
  "TRAIL_CHAIN_COMPLETED_COUNT",
  "LIBRARY_ACCESS_COUNT",
  "WEEKLY_CHALLENGE_WINS_COUNT",
];

export type SessionType = "KC" | "SIMULADO";

export type TriggerParams = {
  sessionType?: SessionType;
  minScorePercent?: number;
  xpThreshold?: number;
  sessionCountThreshold?: number;
};

export type QuestEvent = { completedAt: Date; xp: number };
export type StudyEvent = {
  completedAt: Date;
  gainedXp: number;
  sessionType: SessionType;
  scorePercent: number;
  title: string;
};

export type AchievementAggregates = {
  labCount: number;
  totalXp: number;
  maxStreakDays: number;
  totalSessions: number;
  certBadgesCount: number;
  sessionsByType: Record<SessionType, StudyEvent[]>;
  arenaVictoryCount: number;
  flashcardReviewCount: number;
  flashcardReviewStreakDays: number;
  mentorConsulted: boolean;
  gapClearedCount: number;
  sprintCount: number;
  trailStageCount: number;
  trailChainCompletedCount: number;
  libraryAccessCount: number;
  weeklyChallengeWinsCount: number;
};

function getConsecutiveDaysMax(dates: Date[]): number {
  if (dates.length === 0) {
    return 0;
  }

  const dayKeys = Array.from(
    new Set(
      dates
        .map((date) => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          return d.toISOString();
        })
        .sort(),
    ),
  );

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dayKeys.length; i += 1) {
    const prev = new Date(dayKeys[i - 1]).getTime();
    const curr = new Date(dayKeys[i]).getTime();
    const diffDays = Math.round((curr - prev) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

export function computeAggregates(input: {
  questHistory: QuestEvent[];
  studyHistory: StudyEvent[];
  certBadgesCount: number;
  arenaVictoryCount: number;
  flashcardReviewDates: Date[];
  mentorConsulted: boolean;
  gapClearedCount: number;
  trailStageCount: number;
  trailChainCompletedCount: number;
  libraryAccessCount: number;
  weeklyChallengeWinsCount: number;
}): AchievementAggregates {
  const kcSessions = input.studyHistory.filter((item) => item.sessionType === "KC");
  const simuladoSessions = input.studyHistory.filter((item) => item.sessionType === "SIMULADO");

  const totalXp =
    input.questHistory.reduce((sum, item) => sum + item.xp, 0) +
    input.studyHistory.reduce((sum, item) => sum + item.gainedXp, 0);

  const allDates = [
    ...input.questHistory.map((item) => item.completedAt),
    ...input.studyHistory.map((item) => item.completedAt),
  ];

  // Sprints are regular KC sessions titled "Sprint <mode>" (DEF-003) — no dedicated subtype column.
  const sprintCount = kcSessions.filter((item) => item.title.startsWith("Sprint ")).length;

  return {
    labCount: input.questHistory.length,
    totalXp,
    maxStreakDays: getConsecutiveDaysMax(allDates),
    totalSessions: input.questHistory.length + input.studyHistory.length,
    certBadgesCount: input.certBadgesCount,
    sessionsByType: { KC: kcSessions, SIMULADO: simuladoSessions },
    arenaVictoryCount: input.arenaVictoryCount,
    flashcardReviewCount: input.flashcardReviewDates.length,
    flashcardReviewStreakDays: getConsecutiveDaysMax(input.flashcardReviewDates),
    mentorConsulted: input.mentorConsulted,
    gapClearedCount: input.gapClearedCount,
    sprintCount,
    trailStageCount: input.trailStageCount,
    trailChainCompletedCount: input.trailChainCompletedCount,
    libraryAccessCount: input.libraryAccessCount,
    weeklyChallengeWinsCount: input.weeklyChallengeWinsCount,
  };
}

const SESSION_TYPES: SessionType[] = ["KC", "SIMULADO"];

/** Validates that `params` has the fields a given trigger template needs. Returns an error message, or null if valid. */
export function validateTriggerParams(triggerType: TriggerType, params: TriggerParams | null | undefined): string | null {
  const requireSessionType = () =>
    !params?.sessionType || !SESSION_TYPES.includes(params.sessionType)
      ? "triggerParams.sessionType deve ser KC ou SIMULADO."
      : null;
  const requireMinScorePercent = () =>
    params?.minScorePercent === undefined || params.minScorePercent < 0 || params.minScorePercent > 100
      ? "triggerParams.minScorePercent deve ser um numero entre 0 e 100."
      : null;

  switch (triggerType) {
    case "LAB_COUNT":
    case "XP_TOTAL":
    case "STREAK_DAYS":
    case "TOTAL_SESSIONS":
    case "CERT_COUNT":
    case "ARENA_VICTORY_COUNT":
    case "FLASHCARD_REVIEW_COUNT":
    case "FLASHCARD_REVIEW_STREAK_DAYS":
    case "MENTOR_CONSULTED":
    case "GAP_CLEARED_COUNT":
    case "SPRINT_COUNT":
    case "TRAIL_STAGE_COUNT":
    case "TRAIL_CHAIN_COMPLETED_COUNT":
    case "LIBRARY_ACCESS_COUNT":
    case "WEEKLY_CHALLENGE_WINS_COUNT":
      return null;
    case "SESSION_COUNT":
      return requireSessionType();
    case "SESSION_SCORE_COUNT":
      return requireSessionType() ?? requireMinScorePercent();
    case "XP_AND_SESSION_SCORE_COMBO":
      return (
        requireSessionType() ??
        requireMinScorePercent() ??
        (params?.xpThreshold === undefined || params.xpThreshold <= 0
          ? "triggerParams.xpThreshold deve ser um numero maior que 0."
          : null) ??
        (params?.sessionCountThreshold === undefined || params.sessionCountThreshold <= 0
          ? "triggerParams.sessionCountThreshold deve ser um numero maior que 0."
          : null)
      );
    default:
      return "triggerType invalido.";
  }
}

/** Computes the "current" progress value for a trigger template. Unlock is decided by the caller via `current >= achievement.target`. */
export function currentForTrigger(
  triggerType: TriggerType,
  params: TriggerParams | null | undefined,
  aggregates: AchievementAggregates,
): number {
  switch (triggerType) {
    case "LAB_COUNT":
      return aggregates.labCount;
    case "XP_TOTAL":
      return aggregates.totalXp;
    case "STREAK_DAYS":
      return aggregates.maxStreakDays;
    case "TOTAL_SESSIONS":
      return aggregates.totalSessions;
    case "CERT_COUNT":
      return aggregates.certBadgesCount;
    case "ARENA_VICTORY_COUNT":
      return aggregates.arenaVictoryCount;
    case "FLASHCARD_REVIEW_COUNT":
      return aggregates.flashcardReviewCount;
    case "FLASHCARD_REVIEW_STREAK_DAYS":
      return aggregates.flashcardReviewStreakDays;
    case "MENTOR_CONSULTED":
      return aggregates.mentorConsulted ? 1 : 0;
    case "GAP_CLEARED_COUNT":
      return aggregates.gapClearedCount;
    case "SPRINT_COUNT":
      return aggregates.sprintCount;
    case "TRAIL_STAGE_COUNT":
      return aggregates.trailStageCount;
    case "TRAIL_CHAIN_COMPLETED_COUNT":
      return aggregates.trailChainCompletedCount;
    case "LIBRARY_ACCESS_COUNT":
      return aggregates.libraryAccessCount;
    case "WEEKLY_CHALLENGE_WINS_COUNT":
      return aggregates.weeklyChallengeWinsCount;
    case "SESSION_COUNT": {
      if (!params?.sessionType) return 0;
      return aggregates.sessionsByType[params.sessionType].length;
    }
    case "SESSION_SCORE_COUNT": {
      if (!params?.sessionType || params.minScorePercent === undefined) return 0;
      return aggregates.sessionsByType[params.sessionType].filter(
        (session) => session.scorePercent >= params.minScorePercent!,
      ).length;
    }
    case "XP_AND_SESSION_SCORE_COMBO": {
      const { xpThreshold, sessionType, minScorePercent, sessionCountThreshold } = params ?? {};
      if (
        xpThreshold === undefined ||
        !sessionType ||
        minScorePercent === undefined ||
        sessionCountThreshold === undefined
      ) {
        return 0;
      }
      const passedCount = aggregates.sessionsByType[sessionType].filter(
        (session) => session.scorePercent >= minScorePercent,
      ).length;
      const xpMet = aggregates.totalXp >= xpThreshold ? 1 : 0;
      const sessionMet = passedCount >= sessionCountThreshold ? 1 : 0;
      return xpMet + sessionMet;
    }
    default:
      return 0;
  }
}
