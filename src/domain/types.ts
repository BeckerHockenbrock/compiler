/**
 * Core Domain Entities & Type Definitions
 *
 * All domain types are strictly decoupled from React, DOM APIs,
 * and persistence mechanisms.
 */

export interface StatDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface StatValue {
  readonly current: number;
  readonly lifetimeEarned: number;
}

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly linkedStatIds: readonly string[];
  readonly xp: number;
  readonly level: number;
}

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly notes?: string;
  readonly status: "pending" | "completed";
  readonly priority: TaskPriority;
  /** ISO calendar date (YYYY-MM-DD) */
  readonly dueDate?: string;
  readonly xpReward: number;
  readonly statRewards: Readonly<Record<string, number>>;
  /** ISO 8601 UTC timestamp */
  readonly createdAt: string;
  /** ISO 8601 UTC timestamp */
  readonly updatedAt: string;
  /** ISO 8601 UTC timestamp */
  readonly completedAt?: string;
}

export type HabitFrequency = "daily" | "weekly";

export interface Habit {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly frequency: HabitFrequency;
  readonly targetDaysPerWeek?: number;
  readonly streakCurrent: number;
  readonly streakBest: number;
  /** ISO calendar date (YYYY-MM-DD) */
  readonly lastCompletedDate?: string;
  readonly xpReward: number;
  readonly statRewards: Readonly<Record<string, number>>;
  /** ISO 8601 UTC timestamp */
  readonly createdAt: string;
  /** ISO 8601 UTC timestamp */
  readonly updatedAt: string;
}

export interface ActivityLog {
  readonly id: string;
  readonly type: "task" | "habit" | "manual";
  readonly referenceId?: string;
  readonly title: string;
  /** ISO 8601 UTC timestamp */
  readonly timestamp: string;
  readonly xpEarned: number;
  readonly statDeltas: Readonly<Record<string, number>>;
}

export interface UserProgression {
  readonly totalXp: number;
  readonly level: number;
  readonly availableSkillPoints: number;
  readonly lifetimeCompletedTasks: number;
  readonly lifetimeHabitCompletions: number;
}

export interface UserSettings {
  readonly timeZone: string;
  readonly dailyResetHour: number;
  readonly maxLogRetention: number;
}

export interface AppState {
  readonly progression: UserProgression;
  readonly stats: Readonly<Record<string, StatValue>>;
  readonly statDefinitions: readonly StatDefinition[];
  readonly skills: readonly Skill[];
  readonly tasks: readonly Task[];
  readonly habits: readonly Habit[];
  readonly activityLogs: readonly ActivityLog[];
  readonly settings: UserSettings;
}

export interface ActivityReward {
  readonly xp: number;
  readonly statRewards: Readonly<Record<string, number>>;
  readonly title: string;
  readonly type: "task" | "habit" | "manual";
  readonly referenceId?: string;
}
