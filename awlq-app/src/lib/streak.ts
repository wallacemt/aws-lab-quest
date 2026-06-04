/**
 * Intelligent streak management (ADR-08, RF-08).
 *
 * Streak increments ONLY on real study activity — never on login alone.
 * Idempotent per calendar day: multiple calls for the same day are no-ops.
 * Single source of truth: reads/writes UserBehaviorProfile.streakDays + lastStreakDate.
 */

import { prisma } from "@/lib/prisma";

export type StudyActivity = "flashcards" | "questions" | "sprint" | "daily_review";

export type StreakResult = {
  streakDays: number;
  incrementedToday: boolean;
};

// Minimum amounts for each activity to count as "real study" (RF-08, CA-06).
const ACTIVITY_THRESHOLDS: Record<StudyActivity, number> = {
  flashcards: 10,
  questions: 5,
  sprint: 1,
  daily_review: 1,
};

function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isYesterday(date: Date, today: Date): boolean {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return toCalendarDate(date) === toCalendarDate(yesterday);
}

function isToday(date: Date, today: Date): boolean {
  return toCalendarDate(date) === toCalendarDate(today);
}

/**
 * Records a study activity and updates the streak if eligibility thresholds are met.
 *
 * @param userId   - The user whose streak to update.
 * @param activity - The type of study activity performed.
 * @param amount   - How many units of the activity were completed (default: 1).
 *                   Checked against ACTIVITY_THRESHOLDS.
 * @returns        The resulting streak count and whether it was incremented today.
 */
export async function recordStudyActivity(
  userId: string,
  activity: StudyActivity,
  amount = 1,
): Promise<StreakResult> {
  const threshold = ACTIVITY_THRESHOLDS[activity];

  // Not enough activity to count — read current streak without modifying it.
  if (amount < threshold) {
    const profile = await prisma.userBehaviorProfile.findUnique({
      where: { userId },
      select: { streakDays: true },
    });
    return { streakDays: profile?.streakDays ?? 0, incrementedToday: false };
  }

  const now = new Date();

  // Upsert-safe: get-or-create the profile, then update atomically.
  const profile = await prisma.userBehaviorProfile.upsert({
    where: { userId },
    create: { userId, streakDays: 1, lastStreakDate: now },
    update: {},
    select: { streakDays: true, lastStreakDate: true },
  });

  const { streakDays, lastStreakDate } = profile;

  // Already incremented today — idempotent.
  if (lastStreakDate && isToday(lastStreakDate, now)) {
    return { streakDays, incrementedToday: false };
  }

  let newStreakDays: number;
  if (lastStreakDate && isYesterday(lastStreakDate, now)) {
    // Consecutive day — extend streak.
    newStreakDays = streakDays + 1;
  } else {
    // Gap in study (more than 1 day) — reset to 1.
    newStreakDays = 1;
  }

  const updated = await prisma.userBehaviorProfile.update({
    where: { userId },
    data: { streakDays: newStreakDays, lastStreakDate: now },
    select: { streakDays: true },
  });

  return { streakDays: updated.streakDays, incrementedToday: true };
}
