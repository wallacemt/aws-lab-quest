import { describe, it, expect } from "vitest";
import { computeAggregates, currentForTrigger, validateTriggerParams } from "@/lib/achievement-triggers";

const day = (n: number) => new Date(`2024-01-0${n}T10:00:00.000Z`);

// 3 labs, 5 study sessions (2 KC — one of which is a sprint, 3 SIMULADO) spread
// across 5 consecutive days, 2 cert badges, plus one metric from each of the
// newer feature areas (arena, flashcards, mentor, gaps, trails, library).
const aggregates = computeAggregates({
  questHistory: [
    { completedAt: day(1), xp: 10 },
    { completedAt: day(2), xp: 20 },
    { completedAt: day(3), xp: 30 },
  ],
  studyHistory: [
    { completedAt: day(1), gainedXp: 5, sessionType: "KC", scorePercent: 100, title: "KC Session" },
    { completedAt: day(2), gainedXp: 5, sessionType: "KC", scorePercent: 80, title: "Sprint s3" },
    { completedAt: day(3), gainedXp: 15, sessionType: "SIMULADO", scorePercent: 75, title: "Simulado" },
    { completedAt: day(4), gainedXp: 15, sessionType: "SIMULADO", scorePercent: 90, title: "Simulado" },
    { completedAt: day(5), gainedXp: 15, sessionType: "SIMULADO", scorePercent: 50, title: "Simulado" },
  ],
  certBadgesCount: 2,
  arenaVictoryCount: 4,
  // 4 reviews: day1-2-3 consecutive (streak 3), day5 isolated.
  flashcardReviewDates: [day(1), day(2), day(3), day(5)],
  mentorConsulted: true,
  gapClearedCount: 2,
  trailStageCount: 6,
  trailChainCompletedCount: 1,
  libraryAccessCount: 9,
});
// totalXp = (10+20+30) + (5+5+15+15+15) = 60 + 55 = 115

describe("currentForTrigger", () => {
  it("LAB_COUNT counts quest history entries", () => {
    expect(currentForTrigger("LAB_COUNT", null, aggregates)).toBe(3);
  });

  it("XP_TOTAL sums quest + study xp", () => {
    expect(currentForTrigger("XP_TOTAL", null, aggregates)).toBe(115);
  });

  it("STREAK_DAYS finds the longest run of consecutive days", () => {
    expect(currentForTrigger("STREAK_DAYS", null, aggregates)).toBe(5);
  });

  it("TOTAL_SESSIONS sums labs + study sessions", () => {
    expect(currentForTrigger("TOTAL_SESSIONS", null, aggregates)).toBe(8);
  });

  it("CERT_COUNT reads the cert badge count", () => {
    expect(currentForTrigger("CERT_COUNT", null, aggregates)).toBe(2);
  });

  it("SESSION_COUNT counts sessions of the given type", () => {
    expect(currentForTrigger("SESSION_COUNT", { sessionType: "SIMULADO" }, aggregates)).toBe(3);
    expect(currentForTrigger("SESSION_COUNT", { sessionType: "KC" }, aggregates)).toBe(2);
  });

  it("SESSION_COUNT returns 0 without a sessionType", () => {
    expect(currentForTrigger("SESSION_COUNT", null, aggregates)).toBe(0);
  });

  it("SESSION_SCORE_COUNT counts sessions meeting the score floor", () => {
    expect(currentForTrigger("SESSION_SCORE_COUNT", { sessionType: "KC", minScorePercent: 100 }, aggregates)).toBe(1);
    expect(currentForTrigger("SESSION_SCORE_COUNT", { sessionType: "SIMULADO", minScorePercent: 70 }, aggregates)).toBe(2);
  });

  it("XP_AND_SESSION_SCORE_COMBO counts how many of the two sub-conditions are met", () => {
    expect(
      currentForTrigger(
        "XP_AND_SESSION_SCORE_COMBO",
        { xpThreshold: 115, sessionType: "SIMULADO", minScorePercent: 70, sessionCountThreshold: 2 },
        aggregates,
      ),
    ).toBe(2);

    expect(
      currentForTrigger(
        "XP_AND_SESSION_SCORE_COMBO",
        { xpThreshold: 200, sessionType: "SIMULADO", minScorePercent: 70, sessionCountThreshold: 2 },
        aggregates,
      ),
    ).toBe(1);

    expect(
      currentForTrigger(
        "XP_AND_SESSION_SCORE_COMBO",
        { xpThreshold: 200, sessionType: "SIMULADO", minScorePercent: 99, sessionCountThreshold: 5 },
        aggregates,
      ),
    ).toBe(0);
  });

  it("ARENA_VICTORY_COUNT reads the boss battle victory count", () => {
    expect(currentForTrigger("ARENA_VICTORY_COUNT", null, aggregates)).toBe(4);
  });

  it("FLASHCARD_REVIEW_COUNT reads the total review count", () => {
    expect(currentForTrigger("FLASHCARD_REVIEW_COUNT", null, aggregates)).toBe(4);
  });

  it("FLASHCARD_REVIEW_STREAK_DAYS finds the longest run of consecutive review days", () => {
    expect(currentForTrigger("FLASHCARD_REVIEW_STREAK_DAYS", null, aggregates)).toBe(3);
  });

  it("MENTOR_CONSULTED is 1 when the user has ever asked, 0 otherwise", () => {
    expect(currentForTrigger("MENTOR_CONSULTED", null, aggregates)).toBe(1);
    const neverAsked = computeAggregates({
      questHistory: [],
      studyHistory: [],
      certBadgesCount: 0,
      arenaVictoryCount: 0,
      flashcardReviewDates: [],
      mentorConsulted: false,
      gapClearedCount: 0,
      trailStageCount: 0,
      trailChainCompletedCount: 0,
      libraryAccessCount: 0,
    });
    expect(currentForTrigger("MENTOR_CONSULTED", null, neverAsked)).toBe(0);
  });

  it("GAP_CLEARED_COUNT reads the cleared gap count", () => {
    expect(currentForTrigger("GAP_CLEARED_COUNT", null, aggregates)).toBe(2);
  });

  it("SPRINT_COUNT counts KC sessions titled 'Sprint '", () => {
    expect(currentForTrigger("SPRINT_COUNT", null, aggregates)).toBe(1);
  });

  it("TRAIL_STAGE_COUNT reads the completed stage count", () => {
    expect(currentForTrigger("TRAIL_STAGE_COUNT", null, aggregates)).toBe(6);
  });

  it("TRAIL_CHAIN_COMPLETED_COUNT reads the fully-completed chain count", () => {
    expect(currentForTrigger("TRAIL_CHAIN_COMPLETED_COUNT", null, aggregates)).toBe(1);
  });

  it("LIBRARY_ACCESS_COUNT reads the library access log count", () => {
    expect(currentForTrigger("LIBRARY_ACCESS_COUNT", null, aggregates)).toBe(9);
  });
});

describe("validateTriggerParams", () => {
  it("accepts param-less trigger types with no params", () => {
    expect(validateTriggerParams("XP_TOTAL", null)).toBeNull();
    expect(validateTriggerParams("CERT_COUNT", undefined)).toBeNull();
    expect(validateTriggerParams("ARENA_VICTORY_COUNT", null)).toBeNull();
    expect(validateTriggerParams("FLASHCARD_REVIEW_COUNT", null)).toBeNull();
    expect(validateTriggerParams("FLASHCARD_REVIEW_STREAK_DAYS", null)).toBeNull();
    expect(validateTriggerParams("MENTOR_CONSULTED", null)).toBeNull();
    expect(validateTriggerParams("GAP_CLEARED_COUNT", null)).toBeNull();
    expect(validateTriggerParams("SPRINT_COUNT", null)).toBeNull();
    expect(validateTriggerParams("TRAIL_STAGE_COUNT", null)).toBeNull();
    expect(validateTriggerParams("TRAIL_CHAIN_COMPLETED_COUNT", null)).toBeNull();
    expect(validateTriggerParams("LIBRARY_ACCESS_COUNT", null)).toBeNull();
  });

  it("rejects SESSION_COUNT without a valid sessionType", () => {
    expect(validateTriggerParams("SESSION_COUNT", null)).not.toBeNull();
    expect(validateTriggerParams("SESSION_COUNT", { sessionType: "INVALID" as never })).not.toBeNull();
    expect(validateTriggerParams("SESSION_COUNT", { sessionType: "KC" })).toBeNull();
  });

  it("rejects SESSION_SCORE_COUNT with an out-of-range minScorePercent", () => {
    expect(validateTriggerParams("SESSION_SCORE_COUNT", { sessionType: "KC", minScorePercent: 150 })).not.toBeNull();
    expect(validateTriggerParams("SESSION_SCORE_COUNT", { sessionType: "KC", minScorePercent: 100 })).toBeNull();
  });

  it("requires all four fields for the combo trigger", () => {
    expect(
      validateTriggerParams("XP_AND_SESSION_SCORE_COMBO", { sessionType: "SIMULADO", minScorePercent: 70 }),
    ).not.toBeNull();
    expect(
      validateTriggerParams("XP_AND_SESSION_SCORE_COMBO", {
        sessionType: "SIMULADO",
        minScorePercent: 70,
        xpThreshold: 5000,
        sessionCountThreshold: 5,
      }),
    ).toBeNull();
  });
});
