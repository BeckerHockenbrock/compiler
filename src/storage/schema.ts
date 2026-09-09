/**
 * Storage Schema & Validation
 *
 * Current schema version is set directly here. Migration transition files
 * are introduced only when an actual version bump (e.g. 1 -> 2) occurs.
 */

import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1;

export const StatDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
});

export const StatValueSchema = z.object({
  current: z.number().int().nonnegative(),
  lifetimeEarned: z.number().int().nonnegative(),
});

export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  linkedStatIds: z.array(z.string()),
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
});

export const TaskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(["pending", "completed"]),
  priority: TaskPrioritySchema,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  xpReward: z.number().int().nonnegative(),
  statRewards: z.record(z.string(), z.number().int().nonnegative()),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});

export const HabitFrequencySchema = z.enum(["daily", "weekly"]);

export const HabitSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  frequency: HabitFrequencySchema,
  targetDaysPerWeek: z.number().int().positive().optional(),
  streakCurrent: z.number().int().nonnegative(),
  streakBest: z.number().int().nonnegative(),
  lastCompletedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  xpReward: z.number().int().nonnegative(),
  statRewards: z.record(z.string(), z.number().int().nonnegative()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ActivityLogSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["task", "habit", "manual"]),
  referenceId: z.string().optional(),
  title: z.string().min(1),
  timestamp: z.string(),
  xpEarned: z.number().int().nonnegative(),
  statDeltas: z.record(z.string(), z.number().int()),
});

export const UserProgressionSchema = z.object({
  totalXp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  availableSkillPoints: z.number().int().nonnegative(),
  lifetimeCompletedTasks: z.number().int().nonnegative(),
  lifetimeHabitCompletions: z.number().int().nonnegative(),
});

export const UserSettingsSchema = z.object({
  timeZone: z.string(),
  dailyResetHour: z.number().int().min(0).max(23),
  maxLogRetention: z.number().int().positive(),
});

export const AppStateSchema = z.object({
  progression: UserProgressionSchema,
  stats: z.record(z.string(), StatValueSchema),
  statDefinitions: z.array(StatDefinitionSchema),
  skills: z.array(SkillSchema),
  tasks: z.array(TaskSchema),
  habits: z.array(HabitSchema),
  activityLogs: z.array(ActivityLogSchema),
  settings: UserSettingsSchema,
});

export const StorageEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string(),
  state: AppStateSchema,
});

export const BackupEnvelopeSchema = z.object({
  app: z.literal("personal_progression_app"),
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  checksum: z.string().min(1),
  envelope: StorageEnvelopeSchema,
});
