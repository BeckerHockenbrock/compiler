/**
 * Progression & Leveling Calculations
 *
 * Pure mathematical functions for computing user and skill levels,
 * XP curves, and state transitions upon activity completion.
 */

import type { AppState, ActivityReward, ActivityLog, StatValue } from "./types";
import { nowUtc } from "./date-time";

export interface LevelProgress {
  readonly level: number;
  readonly currentLevelXp: number;
  readonly nextLevelXp: number;
  readonly requiredLevelXp: number;
  readonly progressRatio: number;
}

const XP_BASE_MULTIPLIER = 100;

/**
 * Calculates user or skill level from cumulative XP.
 * Formula: Level = floor(sqrt(XP / 100)) + 1
 * Threshold to reach Level L = 100 * (L - 1)^2
 */
export function calculateLevel(totalXp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(Math.sqrt(safeXp / XP_BASE_MULTIPLIER)) + 1;

  const currentLevelThreshold = XP_BASE_MULTIPLIER * Math.pow(level - 1, 2);
  const nextLevelThreshold = XP_BASE_MULTIPLIER * Math.pow(level, 2);

  const currentLevelXp = safeXp - currentLevelThreshold;
  const requiredLevelXp = nextLevelThreshold - currentLevelThreshold;
  const progressRatio =
    requiredLevelXp > 0 ? Math.min(1, currentLevelXp / requiredLevelXp) : 0;

  return {
    level,
    currentLevelXp,
    nextLevelXp: nextLevelThreshold,
    requiredLevelXp,
    progressRatio,
  };
}

/**
 * Pure state transition: applies an activity reward to AppState,
 * updating progression, stats, and appending an activity log.
 */
export function applyActivityReward(
  currentState: AppState,
  reward: ActivityReward
): { nextState: AppState; levelUpOccurred: boolean; newLevel: number } {
  const currentTotalXp = currentState.progression.totalXp;
  const previousLevel = currentState.progression.level;

  const earnedXp = Math.max(0, Math.floor(reward.xp));
  const newTotalXp = currentTotalXp + earnedXp;
  const progress = calculateLevel(newTotalXp);
  const levelUpOccurred = progress.level > previousLevel;
  const skillPointsEarned = levelUpOccurred
    ? progress.level - previousLevel
    : 0;

  // Update stats immutably
  const updatedStats: Record<string, StatValue> = { ...currentState.stats };
  for (const [statId, delta] of Object.entries(reward.statRewards)) {
    const existing = updatedStats[statId] ?? { current: 0, lifetimeEarned: 0 };
    const safeDelta = Math.max(0, Math.floor(delta));
    updatedStats[statId] = {
      current: existing.current + safeDelta,
      lifetimeEarned: existing.lifetimeEarned + safeDelta,
    };
  }

  // Create immutable activity log entry
  const newLog: ActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: reward.type,
    referenceId: reward.referenceId,
    title: reward.title,
    timestamp: reward.timestamp ?? nowUtc(),
    xpEarned: earnedXp,
    statDeltas: { ...reward.statRewards },
  };

  const nextState: AppState = {
    ...currentState,
    progression: {
      ...currentState.progression,
      totalXp: newTotalXp,
      level: progress.level,
      availableSkillPoints:
        currentState.progression.availableSkillPoints + skillPointsEarned,
      lifetimeCompletedTasks:
        reward.type === "task"
          ? currentState.progression.lifetimeCompletedTasks + 1
          : currentState.progression.lifetimeCompletedTasks,
      lifetimeHabitCompletions:
        reward.type === "habit"
          ? currentState.progression.lifetimeHabitCompletions + 1
          : currentState.progression.lifetimeHabitCompletions,
    },
    stats: updatedStats,
    activityLogs: [newLog, ...currentState.activityLogs],
  };

  return {
    nextState,
    levelUpOccurred,
    newLevel: progress.level,
  };
}
