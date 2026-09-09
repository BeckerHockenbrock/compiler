/**
 * Streak & Recurrence Calculations
 *
 * Deterministic streak evaluations evaluated against calendar dates (YYYY-MM-DD).
 */

import type { Habit } from "./types";
import { calculateCalendarDayDifference, isValidCalendarDate } from "./date-time";

export interface HabitStreakResult {
  readonly streakCurrent: number;
  readonly streakBest: number;
  readonly lastCompletedDate: string;
  readonly isNewDayCompletion: boolean;
}

/**
 * Evaluates the new streak state when a habit is completed on a specific calendar date.
 */
export function evaluateHabitCompletion(
  habit: Habit,
  completionDate: string
): HabitStreakResult {
  if (!isValidCalendarDate(completionDate)) {
    throw new Error(`Invalid completion date: ${completionDate}`);
  }

  // First time completion
  if (!habit.lastCompletedDate) {
    return {
      streakCurrent: 1,
      streakBest: Math.max(1, habit.streakBest),
      lastCompletedDate: completionDate,
      isNewDayCompletion: true,
    };
  }

  const dayDiff = calculateCalendarDayDifference(
    habit.lastCompletedDate,
    completionDate
  );

  // Completed again on the same calendar day
  if (dayDiff === 0) {
    return {
      streakCurrent: habit.streakCurrent,
      streakBest: habit.streakBest,
      lastCompletedDate: completionDate,
      isNewDayCompletion: false,
    };
  }

  // Completed on consecutive day: extend streak
  if (dayDiff === 1) {
    const nextStreak = habit.streakCurrent + 1;
    return {
      streakCurrent: nextStreak,
      streakBest: Math.max(nextStreak, habit.streakBest),
      lastCompletedDate: completionDate,
      isNewDayCompletion: true,
    };
  }

  // Missed one or more days: reset current streak to 1
  if (dayDiff > 1) {
    return {
      streakCurrent: 1,
      streakBest: habit.streakBest,
      lastCompletedDate: completionDate,
      isNewDayCompletion: true,
    };
  }

  // Retroactive completion earlier than lastCompletedDate: keep existing streak
  return {
    streakCurrent: habit.streakCurrent,
    streakBest: habit.streakBest,
    lastCompletedDate: habit.lastCompletedDate,
    isNewDayCompletion: false,
  };
}

/**
 * Checks whether a habit's streak is still alive relative to today's local date.
 * Returns true if completed today (diff 0) or yesterday (diff 1).
 */
export function isStreakActive(
  lastCompletedDate: string | undefined,
  todayDate: string
): boolean {
  if (!lastCompletedDate) return false;
  const dayDiff = calculateCalendarDayDifference(lastCompletedDate, todayDate);
  return dayDiff >= 0 && dayDiff <= 1;
}
