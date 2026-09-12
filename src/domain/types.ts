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
  readonly type: "task" | "habit" | "manual" | "focus";
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

/* ------------------------------------------------------------------ */
/* Season Rank (Monthly Ranked Progression)                           */
/* ------------------------------------------------------------------ */

export type RankTier =
  | "recruit"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master"
  | "apex";

export type RankDivision = "III" | "II" | "I";

export interface WeeklyRankedMission {
  readonly id: string;
  /** Format: YYYY-Www (e.g. 2026-W37) */
  readonly weekKey: string;
  readonly title: string;
  readonly description: string;
  readonly targetCount: number;
  readonly currentCount: number;
  readonly completed: boolean;
  /** ISO 8601 UTC timestamp */
  readonly completedAt?: string;
  readonly srReward: number;
}

export interface SeasonHistoryRecord {
  /** Format: YYYY-MM (e.g. 2026-08) */
  readonly seasonId: string;
  readonly seasonNumber: number;
  readonly label: string;
  readonly finalTier: RankTier;
  readonly finalDivision: RankDivision | null;
  readonly finalSr: number;
  readonly peakTier: RankTier;
  readonly peakDivision: RankDivision | null;
  /** ISO 8601 UTC timestamp */
  readonly completedAt: string;
}

export interface SeasonRankDailyCaps {
  /** ISO calendar date (YYYY-MM-DD) in user timezone */
  readonly date: string;
  readonly taskSrEarned: number;
  readonly habitSrEarned: number;
  readonly focusSrEarned: number;
}

export interface SeasonRankEvidence {
  /** IDs of activities that have already been credited for SR to ensure idempotency */
  readonly creditedActivityIds: readonly string[];
  /** ISO 8601 UTC timestamps of recent qualifying sessions for the 7-day trial window */
  readonly qualifyingSessionTimestamps: readonly string[];
  /** ISO calendar dates (YYYY-MM-DD) with at least one completed qualifying activity */
  readonly activeCalendarDates: readonly string[];
  /** Week keys (YYYY-Www) of claimed/completed weekly missions */
  readonly claimedWeeklyMissionKeys: readonly string[];
}

export interface PromotionTrialStatus {
  readonly isEligible: boolean;
  readonly qualifyingSessionsCount: number;
  readonly qualifyingSessionsTarget: number;
  readonly activeDaysCount: number;
  readonly activeDaysTarget: number;
  readonly weeklyMissionCompleted: boolean;
  readonly isProvisional: boolean;
  readonly allMet: boolean;
}

export interface PreviousSeasonSummary {
  readonly seasonId: string;
  readonly label: string;
  readonly finalTier: RankTier;
  readonly finalDivision: RankDivision | null;
  readonly finalSr: number;
}

export interface SeasonRankState {
  /** Format: YYYY-MM (e.g. 2026-09) */
  readonly currentSeasonId: string;
  readonly currentSeasonLabel: string;
  readonly tier: RankTier;
  readonly division: RankDivision | null;
  readonly sr: number;
  readonly seasonalPeakTier: RankTier;
  readonly seasonalPeakDivision: RankDivision | null;
  readonly allTimePeakTier: RankTier;
  readonly allTimePeakDivision: RankDivision | null;
  readonly provisionalActivitiesCount: number;
  readonly isProvisional: boolean;
  readonly weeklyMission: WeeklyRankedMission;
  readonly dailyCaps: SeasonRankDailyCaps;
  readonly evidence: SeasonRankEvidence;
  readonly history: readonly SeasonHistoryRecord[];
  readonly previousSeasonSummary?: PreviousSeasonSummary;
}

/* ------------------------------------------------------------------ */
/* Study Timer                                                        */
/* ------------------------------------------------------------------ */

export type StudyTimerStatus = "idle" | "running" | "paused";

export type StudyTimerDurationMinutes = 25 | 50 | 75;

export type StudyTimerActionResult = "normal" | "completed" | "noop";

export interface StudyTimerState {
  readonly status: StudyTimerStatus;
  readonly sessionId: string | null;
  readonly durationMinutes: StudyTimerDurationMinutes;
  /** UTC ISO 8601 timestamp for active running segment, null if idle/paused */
  readonly segmentStartedAt: string | null;
  /** Accumulated elapsed milliseconds across previous paused segments */
  readonly accumulatedElapsedMs: number;
  /** Last completed session ID to guarantee completion idempotency */
  readonly lastCompletedSessionId?: string | null;
}

export interface CompletedStudySessionSummary {
  readonly sessionId: string;
  readonly durationMinutes: StudyTimerDurationMinutes;
  readonly completedAt: string;
  readonly xpEarned: number;
  readonly srEarned: number;
  readonly statDeltas: Readonly<Record<string, number>>;
  readonly levelUpOccurred: boolean;
  readonly newLevel: number;
  readonly promoted: boolean;
  readonly newTier: RankTier;
  readonly newDivision: RankDivision | null;
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
  readonly seasonRank: SeasonRankState;
  readonly studyTimer: StudyTimerState;
}

export interface ActivityReward {
  readonly xp: number;
  readonly statRewards: Readonly<Record<string, number>>;
  readonly title: string;
  readonly type: "task" | "habit" | "manual" | "focus";
  readonly referenceId?: string;
  readonly timestamp?: string;
}
