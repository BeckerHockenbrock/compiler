/**
 * Storage Schema & Validation
 *
 * Current schema version is set directly here. Migration transition files
 * are introduced only when an actual version bump (e.g. 1 -> 2) occurs.
 */

import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 3;

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
  type: z.enum(["task", "habit", "manual", "focus"]),
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

/* ------------------------------------------------------------------ */
/* Season Rank Schemas                                                */
/* ------------------------------------------------------------------ */

export const RankTierSchema = z.enum([
  "recruit",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "master",
  "apex",
]);

export const RankDivisionSchema = z.enum(["III", "II", "I"]);

export const WeeklyRankedMissionSchema = z.object({
  id: z.string().min(1),
  weekKey: z.string().regex(/^\d{4}-W\d{2}$/),
  title: z.string().min(1),
  description: z.string(),
  targetCount: z.number().int().positive(),
  currentCount: z.number().int().nonnegative(),
  completed: z.boolean(),
  completedAt: z.string().optional(),
  srReward: z.number().int().nonnegative(),
});

export const SeasonHistoryRecordSchema = z.object({
  seasonId: z.string().regex(/^\d{4}-\d{2}$/),
  seasonNumber: z.number().int().positive(),
  label: z.string().min(1),
  finalTier: RankTierSchema,
  finalDivision: RankDivisionSchema.nullable(),
  finalSr: z.number().int().nonnegative(),
  peakTier: RankTierSchema,
  peakDivision: RankDivisionSchema.nullable(),
  completedAt: z.string(),
});

export const SeasonRankDailyCapsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taskSrEarned: z.number().int().nonnegative(),
  habitSrEarned: z.number().int().nonnegative(),
  focusSrEarned: z.number().int().nonnegative(),
});

export const SeasonRankEvidenceSchema = z.object({
  creditedActivityIds: z.array(z.string()),
  qualifyingSessionTimestamps: z.array(z.string()),
  activeCalendarDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  claimedWeeklyMissionKeys: z.array(z.string()),
});

export const PreviousSeasonSummarySchema = z.object({
  seasonId: z.string().regex(/^\d{4}-\d{2}$/),
  label: z.string().min(1),
  finalTier: RankTierSchema,
  finalDivision: RankDivisionSchema.nullable(),
  finalSr: z.number().int().nonnegative(),
});

export const SeasonRankStateSchema = z.object({
  currentSeasonId: z.string().regex(/^\d{4}-\d{2}$/),
  currentSeasonLabel: z.string().min(1),
  tier: RankTierSchema,
  division: RankDivisionSchema.nullable(),
  sr: z.number().int().nonnegative(),
  seasonalPeakTier: RankTierSchema,
  seasonalPeakDivision: RankDivisionSchema.nullable(),
  allTimePeakTier: RankTierSchema,
  allTimePeakDivision: RankDivisionSchema.nullable(),
  provisionalActivitiesCount: z.number().int().nonnegative(),
  isProvisional: z.boolean(),
  weeklyMission: WeeklyRankedMissionSchema,
  dailyCaps: SeasonRankDailyCapsSchema,
  evidence: SeasonRankEvidenceSchema,
  history: z.array(SeasonHistoryRecordSchema),
  previousSeasonSummary: PreviousSeasonSummarySchema.optional(),
});

/* ------------------------------------------------------------------ */
/* Study Timer Schemas                                                */
/* ------------------------------------------------------------------ */

export const StudyTimerStatusSchema = z.enum(["idle", "running", "paused"]);

export const StudyTimerDurationMinutesSchema = z.union([
  z.literal(25),
  z.literal(50),
  z.literal(75),
]);

export const StudyTimerStateSchema = z.object({
  status: StudyTimerStatusSchema,
  sessionId: z.string().nullable(),
  durationMinutes: StudyTimerDurationMinutesSchema,
  segmentStartedAt: z.string().nullable(),
  accumulatedElapsedMs: z.number().int().nonnegative(),
  lastCompletedSessionId: z.string().nullable().optional(),
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
  seasonRank: SeasonRankStateSchema,
  studyTimer: StudyTimerStateSchema,
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
