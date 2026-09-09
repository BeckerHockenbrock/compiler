/**
 * Pure Domain Logic for Habit / Ritual Operations
 *
 * Implements calendar-day streak tracking, same-day duplicate completion
 * prevention, and immutable reward attribution.
 */

import type { AppState, Habit, HabitFrequency } from "./types";
import { nowUtc, toLocalDate } from "./date-time";
import { evaluateHabitCompletion } from "./streaks";
import { applyActivityReward } from "./progression";

export interface CreateHabitInput {
  readonly title: string;
  readonly description?: string;
  readonly frequency?: HabitFrequency;
  readonly xpReward: number;
  readonly statRewards?: Readonly<Record<string, number>>;
  readonly targetDaysPerWeek?: number;
}

export interface CompleteHabitResult {
  readonly nextState: AppState;
  readonly habitCompleted: boolean;
  readonly streakCurrent: number;
  readonly streakBest: number;
  readonly xpAwarded: number;
  readonly levelUpOccurred: boolean;
  readonly newLevel: number;
}

/**
 * Creates a new daily habit/ritual and appends it to state.
 */
export function createHabit(
  currentState: AppState,
  input: CreateHabitInput
): { nextState: AppState; habit: Habit } {
  const timestamp = nowUtc();
  const safeTitle = input.title.trim();
  const safeXp = Math.max(0, Math.floor(input.xpReward));

  const newHabit: Habit = {
    id: `habit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: safeTitle || "Daily Ritual",
    description: input.description?.trim() || undefined,
    frequency: input.frequency ?? "daily",
    targetDaysPerWeek: input.targetDaysPerWeek,
    streakCurrent: 0,
    streakBest: 0,
    xpReward: safeXp,
    statRewards: input.statRewards ? { ...input.statRewards } : {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    nextState: {
      ...currentState,
      habits: [...currentState.habits, newHabit],
    },
    habit: newHabit,
  };
}

/**
 * Completes a habit for today's local calendar day.
 *
 * IDEMPOTENCY GUARANTEE:
 * If the habit was already completed on the same calendar day, returns
 * habitCompleted = false with 0 XP awarded, preventing multiple daily check-ins.
 */
export function completeHabit(
  currentState: AppState,
  habitId: string,
  explicitDate?: string
): CompleteHabitResult {
  const targetHabit = currentState.habits.find((h) => h.id === habitId);

  if (!targetHabit) {
    return {
      nextState: currentState,
      habitCompleted: false,
      streakCurrent: 0,
      streakBest: 0,
      xpAwarded: 0,
      levelUpOccurred: false,
      newLevel: currentState.progression.level,
    };
  }

  const todayDate =
    explicitDate ?? toLocalDate(nowUtc(), currentState.settings.timeZone);

  // If already completed today, reject duplicate check-in
  if (targetHabit.lastCompletedDate === todayDate) {
    return {
      nextState: currentState,
      habitCompleted: false,
      streakCurrent: targetHabit.streakCurrent,
      streakBest: targetHabit.streakBest,
      xpAwarded: 0,
      levelUpOccurred: false,
      newLevel: currentState.progression.level,
    };
  }

  // Calculate new streak state
  const streakResult = evaluateHabitCompletion(targetHabit, todayDate);
  const timestamp = nowUtc();

  const updatedHabit: Habit = {
    ...targetHabit,
    streakCurrent: streakResult.streakCurrent,
    streakBest: streakResult.streakBest,
    lastCompletedDate: todayDate,
    updatedAt: timestamp,
  };

  const nextHabits = currentState.habits.map((h) =>
    h.id === habitId ? updatedHabit : h
  );

  const stateWithUpdatedHabit: AppState = {
    ...currentState,
    habits: nextHabits,
  };

  // Award progression rewards
  const rewardResult = applyActivityReward(stateWithUpdatedHabit, {
    xp: targetHabit.xpReward,
    statRewards: targetHabit.statRewards,
    title: `Completed daily ritual: ${targetHabit.title}`,
    type: "habit",
    referenceId: targetHabit.id,
  });

  return {
    nextState: rewardResult.nextState,
    habitCompleted: true,
    streakCurrent: streakResult.streakCurrent,
    streakBest: streakResult.streakBest,
    xpAwarded: targetHabit.xpReward,
    levelUpOccurred: rewardResult.levelUpOccurred,
    newLevel: rewardResult.newLevel,
  };
}

/**
 * Deletes a habit from the user's active list.
 */
export function deleteHabit(
  currentState: AppState,
  habitId: string
): { nextState: AppState; habitDeleted: boolean } {
  const exists = currentState.habits.some((h) => h.id === habitId);
  if (!exists) {
    return { nextState: currentState, habitDeleted: false };
  }

  return {
    nextState: {
      ...currentState,
      habits: currentState.habits.filter((h) => h.id !== habitId),
    },
    habitDeleted: true,
  };
}
