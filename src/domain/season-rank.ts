/**
 * Season Rank Domain Engine
 *
 * Pure mathematical and state transition functions for the monthly Ranked system.
 * Zero dependencies on React, DOM APIs, or browser storage.
 */

import type {
  AppState,
  RankTier,
  RankDivision,
  WeeklyRankedMission,
  SeasonHistoryRecord,
  SeasonRankDailyCaps,
  SeasonRankEvidence,
  PromotionTrialStatus,
  PreviousSeasonSummary,
  SeasonRankState,
  TaskPriority,
} from "./types";
import { nowUtc, toLocalDate, isValidCalendarDate } from "./date-time";

/* ------------------------------------------------------------------ */
/* Ladder Specification & Hierarchy                                   */
/* ------------------------------------------------------------------ */

export interface RankRung {
  readonly tier: RankTier;
  readonly division: RankDivision | null;
  readonly label: string;
}

/**
 * The single 20-rung ladder from Recruit III (lowest, index 0) to Apex (highest, index 19).
 */
export const RANK_LADDER: readonly RankRung[] = [
  { tier: "recruit", division: "III", label: "Recruit III" },
  { tier: "recruit", division: "II", label: "Recruit II" },
  { tier: "recruit", division: "I", label: "Recruit I" },
  { tier: "bronze", division: "III", label: "Bronze III" },
  { tier: "bronze", division: "II", label: "Bronze II" },
  { tier: "bronze", division: "I", label: "Bronze I" },
  { tier: "silver", division: "III", label: "Silver III" },
  { tier: "silver", division: "II", label: "Silver II" },
  { tier: "silver", division: "I", label: "Silver I" },
  { tier: "gold", division: "III", label: "Gold III" },
  { tier: "gold", division: "II", label: "Gold II" },
  { tier: "gold", division: "I", label: "Gold I" },
  { tier: "platinum", division: "III", label: "Platinum III" },
  { tier: "platinum", division: "II", label: "Platinum II" },
  { tier: "platinum", division: "I", label: "Platinum I" },
  { tier: "diamond", division: "III", label: "Diamond III" },
  { tier: "diamond", division: "II", label: "Diamond II" },
  { tier: "diamond", division: "I", label: "Diamond I" },
  { tier: "master", division: null, label: "Master" },
  { tier: "apex", division: null, label: "Apex" },
] as const;

export const RANK_TIERS: readonly RankTier[] = [
  "recruit",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "master",
  "apex",
] as const;

export const RANK_MATERIALS = {
  recruit: { name: "Slate", primaryColor: "#94a3b8", glowColor: "rgba(148, 163, 184, 0.25)" },
  bronze: { name: "Copper", primaryColor: "#cd7f32", glowColor: "rgba(205, 127, 50, 0.25)" },
  silver: { name: "Steel", primaryColor: "#cbd5e1", glowColor: "rgba(203, 213, 225, 0.25)" },
  gold: { name: "Muted Gold", primaryColor: "#eab308", glowColor: "rgba(234, 179, 8, 0.25)" },
  platinum: { name: "Cyan-Blue", primaryColor: "#38bdf8", glowColor: "rgba(56, 189, 248, 0.3)" },
  diamond: { name: "Violet-Blue", primaryColor: "#818cf8", glowColor: "rgba(129, 140, 248, 0.3)" },
  master: { name: "Magenta-Blue", primaryColor: "#c084fc", glowColor: "rgba(192, 132, 252, 0.35)" },
  apex: { name: "Electric Halo", primaryColor: "#ffffff", glowColor: "rgba(0, 144, 255, 0.5)" },
} as const;

/* ------------------------------------------------------------------ */
/* Constants & Caps                                                   */
/* ------------------------------------------------------------------ */

export const SR_PER_DIVISION = 100;
export const DAILY_TASK_SR_CAP = 25;
export const DAILY_HABIT_SR_CAP = 10;
export const DAILY_FOCUS_SR_CAP = 40; // Extension point
export const WEEKLY_MISSION_SR_REWARD = 25;
export const PROVISIONAL_ACTIVITIES_REQUIRED = 3;

export const TASK_SR_AWARDS: Readonly<Record<TaskPriority, number>> = {
  low: 3,
  medium: 6,
  high: 10,
  urgent: 15,
};

export const HABIT_SR_AWARD = 5;
export const FOCUS_SR_AWARD_PER_BLOCK = 10; // Extension point

/* ------------------------------------------------------------------ */
/* Ladder & Index Functions                                           */
/* ------------------------------------------------------------------ */

export function findLadderIndex(tier: RankTier, division: RankDivision | null): number {
  const normDivision = (tier === "master" || tier === "apex") ? null : division;
  const idx = RANK_LADDER.findIndex(
    (r) => r.tier === tier && r.division === normDivision
  );
  return idx >= 0 ? idx : 0;
}

export function getRankRung(index: number): RankRung {
  const clamped = Math.max(0, Math.min(RANK_LADDER.length - 1, Math.floor(index)));
  return RANK_LADDER[clamped];
}

export function compareRanks(
  tierA: RankTier,
  divA: RankDivision | null,
  tierB: RankTier,
  divB: RankDivision | null
): number {
  return findLadderIndex(tierA, divA) - findLadderIndex(tierB, divB);
}

export function formatRankLabel(tier: RankTier, division: RankDivision | null): string {
  const capitalizedTier = tier.charAt(0).toUpperCase() + tier.slice(1);
  if (tier === "master" || tier === "apex" || !division) {
    return capitalizedTier;
  }
  return `${capitalizedTier} ${division}`;
}

/**
 * Evaluates whether advancing from the current rank crosses a major tier boundary
 * into Bronze, Silver, Gold, Platinum, Diamond, Master, or Apex.
 */
export function isTierPromotionBoundary(tier: RankTier, division: RankDivision | null): boolean {
  if (tier === "apex") return false;
  if (tier === "master") return true; // Master -> Apex
  return division === "I"; // Any Tier I -> Next Tier III
}

/**
 * Calculates monthly soft-reset seeding: consistently 2 ladder rungs (divisions) below final rank.
 * Consistent formula: seededIndex = max(0, currentIndex - 2).
 * - Apex (19) -> Diamond I (17)
 * - Master (18) -> Diamond II (16)
 * - Diamond I (17) -> Diamond III (15)
 * - Gold II (10) -> Silver I (8)
 * - Ranks at or below Bronze III (index <= 3) cleanly seed to Recruit III (0).
 */
export function calculateSeededRank(
  finalTier: RankTier,
  finalDivision: RankDivision | null
): RankRung {
  const currentIndex = findLadderIndex(finalTier, finalDivision);

  // Ranks at or below Bronze III (index <= 3) reset to Recruit III (0)
  if (currentIndex <= 3) {
    return getRankRung(0);
  }

  // Consistent 2-rung descent across the entire ladder
  const seededIndex = Math.max(0, currentIndex - 2);
  return getRankRung(seededIndex);
}

/* ------------------------------------------------------------------ */
/* Date, Timezone & Season Identification                             */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/**
 * Extracts season ID (YYYY-MM) in the user's active timezone.
 */
export function getSeasonId(utcTimestamp: string, timeZone: string): string {
  const localDateStr = toLocalDate(utcTimestamp, timeZone);
  return localDateStr.slice(0, 7); // YYYY-MM
}

/**
 * Formats "2026-09" as "Season 09 · September 2026"
 */
export function formatSeasonLabel(seasonId: string): string {
  const [yearStr, monthStr] = seasonId.split("-");
  const monthNum = parseInt(monthStr, 10);
  const monthName = MONTH_NAMES[(monthNum - 1) % 12] ?? "Season";
  return `Season ${monthStr} · ${monthName} ${yearStr}`;
}

/**
 * Calculates days remaining in the active calendar month.
 */
export function getDaysRemainingInSeason(utcTimestamp: string, timeZone: string): number {
  const localDate = toLocalDate(utcTimestamp, timeZone);
  const [yearStr, monthStr, dayStr] = localDate.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Total days in current month via UTC Date
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(0, totalDays - day);
}

/**
 * Computes deterministic ISO week key: YYYY-Www (e.g. 2026-W37)
 * based on the local calendar date.
 */
export function getIsoWeekKey(localCalendarDate: string): string {
  if (!isValidCalendarDate(localCalendarDate)) {
    throw new Error(`Invalid calendar date for week key: ${localCalendarDate}`);
  }
  const [y, m, d] = localCalendarDate.split("-").map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d));

  // Thursday in current week decides the ISO year
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const padWeek = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${date.getUTCFullYear()}-W${padWeek}`;
}

/* ------------------------------------------------------------------ */
/* Weekly Ranked Mission                                              */
/* ------------------------------------------------------------------ */

export function createWeeklyMission(weekKey: string): WeeklyRankedMission {
  return {
    id: `mission_${weekKey}`,
    weekKey,
    title: "Weekly Focus Cadence",
    description: "Complete 5 qualifying activities this week",
    targetCount: 5,
    currentCount: 0,
    completed: false,
    srReward: WEEKLY_MISSION_SR_REWARD,
  };
}

/* ------------------------------------------------------------------ */
/* Initial State Generation                                           */
/* ------------------------------------------------------------------ */

export function createInitialSeasonRankState(
  timestamp: string = nowUtc(),
  timeZone: string = "UTC"
): SeasonRankState {
  const currentSeasonId = getSeasonId(timestamp, timeZone);
  const currentSeasonLabel = formatSeasonLabel(currentSeasonId);
  const localDate = toLocalDate(timestamp, timeZone);
  const currentWeekKey = getIsoWeekKey(localDate);

  const initialDailyCaps: SeasonRankDailyCaps = {
    date: localDate,
    taskSrEarned: 0,
    habitSrEarned: 0,
    focusSrEarned: 0,
  };

  const initialEvidence: SeasonRankEvidence = {
    creditedActivityIds: [],
    qualifyingSessionTimestamps: [],
    activeCalendarDates: [],
    claimedWeeklyMissionKeys: [],
  };

  return {
    currentSeasonId,
    currentSeasonLabel,
    tier: "recruit",
    division: "III",
    sr: 0,
    seasonalPeakTier: "recruit",
    seasonalPeakDivision: "III",
    allTimePeakTier: "recruit",
    allTimePeakDivision: "III",
    provisionalActivitiesCount: 0,
    isProvisional: true,
    weeklyMission: createWeeklyMission(currentWeekKey),
    dailyCaps: initialDailyCaps,
    evidence: initialEvidence,
    history: [],
  };
}

/* ------------------------------------------------------------------ */
/* Promotion Trial Evaluation                                         */
/* ------------------------------------------------------------------ */

export function evaluatePromotionTrial(
  seasonRank: SeasonRankState,
  targetTier: RankTier,
  currentDateStr: string,
  timeZone: string
): PromotionTrialStatus {
  const isEligible = seasonRank.sr >= SR_PER_DIVISION;
  const isHighTier = targetTier === "master" || targetTier === "apex";
  const activeDaysTarget = isHighTier ? 5 : 4;
  const qualifyingSessionsTarget = 3;

  // 7-day calendar window: [targetDate - 6 days, targetDate]
  const [y, m, d] = currentDateStr.split("-").map((n) => parseInt(n, 10));
  const currentUtcMs = Date.UTC(y, m - 1, d);
  const MS_PER_DAY = 86400000;
  const windowStartMs = currentUtcMs - 6 * MS_PER_DAY;

  // Active days in window
  let activeDaysCount = 0;
  for (const dateStr of seasonRank.evidence.activeCalendarDates) {
    if (isValidCalendarDate(dateStr)) {
      const [dy, dm, dd] = dateStr.split("-").map((n) => parseInt(n, 10));
      const dateMs = Date.UTC(dy, dm - 1, dd);
      if (dateMs >= windowStartMs && dateMs <= currentUtcMs) {
        activeDaysCount += 1;
      }
    }
  }

  // Qualifying sessions in window
  let qualifyingSessionsCount = 0;
  for (const ts of seasonRank.evidence.qualifyingSessionTimestamps) {
    const sessionLocalDate = toLocalDate(ts, timeZone);
    if (isValidCalendarDate(sessionLocalDate)) {
      const [sy, sm, sd] = sessionLocalDate.split("-").map((n) => parseInt(n, 10));
      const sessionMs = Date.UTC(sy, sm - 1, sd);
      if (sessionMs >= windowStartMs && sessionMs <= currentUtcMs) {
        qualifyingSessionsCount += 1;
      }
    }
  }

  const weeklyMissionCompleted = seasonRank.weeklyMission.completed;
  const isProvisional = seasonRank.isProvisional;

  // Promotion is blocked while provisional, even if SR >= 100 and trial criteria met
  const allMet =
    isEligible &&
    !isProvisional &&
    qualifyingSessionsCount >= qualifyingSessionsTarget &&
    activeDaysCount >= activeDaysTarget &&
    weeklyMissionCompleted;

  return {
    isEligible,
    qualifyingSessionsCount,
    qualifyingSessionsTarget,
    activeDaysCount,
    activeDaysTarget,
    weeklyMissionCompleted,
    isProvisional,
    allMet,
  };
}

/* ------------------------------------------------------------------ */
/* Core Activity Application to Season Rank                           */
/* ------------------------------------------------------------------ */

export interface ApplyActivityResult {
  readonly nextSeasonRank: SeasonRankState;
  readonly srEarned: number;
  readonly promoted: boolean;
  readonly newTier: RankTier;
  readonly newDivision: RankDivision | null;
  readonly trialStatus: PromotionTrialStatus;
}

/**
 * Pure state transition applying a completed task, habit, or focus session to Season Rank.
 * Handles:
 * - Deduplication via creditedActivityIds
 * - Daily cap enforcement (task: 25, habit: 10, focus: 40)
 * - Backward clock protection
 * - Provisional count increment (up to 3)
 * - Weekly mission progress & auto-claim of 25 SR
 * - Division advancement & Promotion trial gating
 * - Peak rank updates
 */
export function applyActivityToSeasonRank(
  currentState: SeasonRankState,
  activityId: string,
  activityType: "task" | "habit" | "focus",
  timestamp: string,
  timeZone: string,
  taskPriority: TaskPriority = "medium"
): ApplyActivityResult {
  const localDate = toLocalDate(timestamp, timeZone);
  const currentWeekKey = getIsoWeekKey(localDate);

  // 1. Deduplication guard
  if (currentState.evidence.creditedActivityIds.includes(activityId)) {
    const trialStatus = evaluatePromotionTrial(
      currentState,
      currentState.tier,
      localDate,
      timeZone
    );
    return {
      nextSeasonRank: currentState,
      srEarned: 0,
      promoted: false,
      newTier: currentState.tier,
      newDivision: currentState.division,
      trialStatus,
    };
  }

  // 2. Reconcile daily caps for local date (backward clock safe: if date < caps.date, don't reset)
  let dailyCaps = currentState.dailyCaps;
  if (localDate > dailyCaps.date) {
    dailyCaps = {
      date: localDate,
      taskSrEarned: 0,
      habitSrEarned: 0,
      focusSrEarned: 0,
    };
  }

  // 3. Compute SR award under daily caps
  let rawSr = 0;
  let srEarned = 0;
  let updatedDailyCaps = dailyCaps;

  if (activityType === "task") {
    rawSr = TASK_SR_AWARDS[taskPriority] ?? 6;
    const availableTaskSr = Math.max(0, DAILY_TASK_SR_CAP - dailyCaps.taskSrEarned);
    srEarned = Math.min(rawSr, availableTaskSr);
    updatedDailyCaps = {
      ...dailyCaps,
      taskSrEarned: dailyCaps.taskSrEarned + srEarned,
    };
  } else if (activityType === "habit") {
    rawSr = HABIT_SR_AWARD;
    const availableHabitSr = Math.max(0, DAILY_HABIT_SR_CAP - dailyCaps.habitSrEarned);
    srEarned = Math.min(rawSr, availableHabitSr);
    updatedDailyCaps = {
      ...dailyCaps,
      habitSrEarned: dailyCaps.habitSrEarned + srEarned,
    };
  } else if (activityType === "focus") {
    rawSr = FOCUS_SR_AWARD_PER_BLOCK;
    const availableFocusSr = Math.max(0, DAILY_FOCUS_SR_CAP - dailyCaps.focusSrEarned);
    srEarned = Math.min(rawSr, availableFocusSr);
    updatedDailyCaps = {
      ...dailyCaps,
      focusSrEarned: dailyCaps.focusSrEarned + srEarned,
    };
  }

  // 4. Update Provisional Count (first 3 qualifying activities in season)
  const nextProvisionalCount = Math.min(
    PROVISIONAL_ACTIVITIES_REQUIRED,
    currentState.provisionalActivitiesCount + 1
  );
  const nextIsProvisional = nextProvisionalCount < PROVISIONAL_ACTIVITIES_REQUIRED;

  // 5. Update Weekly Mission
  let weeklyMission = currentState.weeklyMission;
  let missionSrAward = 0;
  const claimedMissionKeys = [...currentState.evidence.claimedWeeklyMissionKeys];

  // If week has rolled over, initialize fresh weekly mission
  if (weeklyMission.weekKey !== currentWeekKey) {
    weeklyMission = createWeeklyMission(currentWeekKey);
  }

  if (!weeklyMission.completed) {
    const nextMissionCount = weeklyMission.currentCount + 1;
    const missionCompleted = nextMissionCount >= weeklyMission.targetCount;
    if (missionCompleted && !claimedMissionKeys.includes(currentWeekKey)) {
      weeklyMission = {
        ...weeklyMission,
        currentCount: weeklyMission.targetCount,
        completed: true,
        completedAt: timestamp,
      };
      missionSrAward = weeklyMission.srReward; // +25 SR
      claimedMissionKeys.push(currentWeekKey);
    } else {
      weeklyMission = {
        ...weeklyMission,
        currentCount: nextMissionCount,
      };
    }
  }

  // Total SR earned in this activity step
  const totalSrToAdd = srEarned + missionSrAward;

  // 6. Update Evidence
  const updatedActiveDates = currentState.evidence.activeCalendarDates.includes(localDate)
    ? currentState.evidence.activeCalendarDates
    : [...currentState.evidence.activeCalendarDates, localDate];

  const updatedEvidence: SeasonRankEvidence = {
    creditedActivityIds: [...currentState.evidence.creditedActivityIds, activityId],
    qualifyingSessionTimestamps: [
      timestamp,
      ...currentState.evidence.qualifyingSessionTimestamps.slice(0, 49),
    ],
    activeCalendarDates: updatedActiveDates,
    claimedWeeklyMissionKeys: claimedMissionKeys,
  };

  // 7. Calculate new SR and evaluate division advancement or promotion trial
  let currentSr = currentState.sr + totalSrToAdd;
  let currentTier = currentState.tier;
  let currentDivision = currentState.division;
  let promoted = false;

  const currentRungIndex = findLadderIndex(currentTier, currentDivision);
  const isApex = currentTier === "apex";

  if (isApex) {
    currentSr = Math.min(SR_PER_DIVISION, currentSr);
  } else {
    const nextRung = getRankRung(currentRungIndex + 1);
    const isBoundary = isTierPromotionBoundary(currentTier, currentDivision);

    if (isBoundary) {
      // Crossing tier boundary (e.g. Recruit I -> Bronze III or Master -> Apex)
      // Cap SR at 100 until promotion trial requirements are fully satisfied
      currentSr = Math.min(SR_PER_DIVISION, currentSr);

      const trialEvaluationRankState: SeasonRankState = {
        ...currentState,
        sr: currentSr,
        isProvisional: nextIsProvisional,
        provisionalActivitiesCount: nextProvisionalCount,
        weeklyMission,
        evidence: updatedEvidence,
      };

      const trial = evaluatePromotionTrial(
        trialEvaluationRankState,
        nextRung.tier,
        localDate,
        timeZone
      );

      if (trial.allMet) {
        // Promotion unlocked! Advance to next tier rung and reset SR to 0
        currentTier = nextRung.tier;
        currentDivision = nextRung.division;
        currentSr = 0;
        promoted = true;
      }
    } else {
      // Intra-tier division advance (e.g. Recruit III -> Recruit II or Bronze II -> Bronze I)
      // Advance automatically upon reaching 100 SR; preserve overflow
      if (currentSr >= SR_PER_DIVISION) {
        const overflow = currentSr - SR_PER_DIVISION;
        currentTier = nextRung.tier;
        currentDivision = nextRung.division;
        currentSr = overflow;
        promoted = true;
      }
    }
  }

  // 8. Update Peaks
  let seasonalPeakTier = currentState.seasonalPeakTier;
  let seasonalPeakDivision = currentState.seasonalPeakDivision;
  if (compareRanks(currentTier, currentDivision, seasonalPeakTier, seasonalPeakDivision) > 0) {
    seasonalPeakTier = currentTier;
    seasonalPeakDivision = currentDivision;
  }

  let allTimePeakTier = currentState.allTimePeakTier;
  let allTimePeakDivision = currentState.allTimePeakDivision;
  if (compareRanks(currentTier, currentDivision, allTimePeakTier, allTimePeakDivision) > 0) {
    allTimePeakTier = currentTier;
    allTimePeakDivision = currentDivision;
  }

  const nextSeasonRank: SeasonRankState = {
    ...currentState,
    tier: currentTier,
    division: currentDivision,
    sr: currentSr,
    seasonalPeakTier,
    seasonalPeakDivision,
    allTimePeakTier,
    allTimePeakDivision,
    provisionalActivitiesCount: nextProvisionalCount,
    isProvisional: nextIsProvisional,
    weeklyMission,
    dailyCaps: updatedDailyCaps,
    evidence: updatedEvidence,
  };

  const finalNextRung = getRankRung(findLadderIndex(currentTier, currentDivision) + 1);
  const trialStatus = evaluatePromotionTrial(
    nextSeasonRank,
    finalNextRung.tier,
    localDate,
    timeZone
  );

  return {
    nextSeasonRank,
    srEarned: totalSrToAdd,
    promoted,
    newTier: currentTier,
    newDivision: currentDivision,
    trialStatus,
  };
}

/* ------------------------------------------------------------------ */
/* Monthly Rollover & Skipped Months Safeguard                        */
/* ------------------------------------------------------------------ */

export interface RolloverResult {
  readonly nextState: AppState;
  readonly rolledOver: boolean;
  readonly previousSeasonSummary?: PreviousSeasonSummary;
}

/**
 * Checks if the month has changed in the user's timezone and applies an idempotent rollover.
 * - Saves completed season permanently to history (at most 1 entry for the last active season).
 * - Never duplicates history if called repeatedly.
 * - Seeds user 2 divisions below final rank.
 * - Resets SR to 0, resets provisional count, preserves all-time peak.
 */
export function checkAndApplySeasonRollover(
  state: AppState,
  timestamp: string = nowUtc(),
  timeZoneOverride?: string
): RolloverResult {
  const timeZone = timeZoneOverride ?? state.settings.timeZone ?? "UTC";
  const activeSeasonId = getSeasonId(timestamp, timeZone);

  // Rollover must strictly occur ONLY when the active season ID is later than the stored season ID.
  // A backward device-clock change (e.g. September back to August) must NEVER archive or reset the season.
  if (activeSeasonId <= state.seasonRank.currentSeasonId) {
    return { nextState: state, rolledOver: false };
  }

  // Active month has advanced: execute rollover
  const localDate = toLocalDate(timestamp, timeZone);
  const currentWeekKey = getIsoWeekKey(localDate);

  // 1. Build completed season history record
  const completedRecord: SeasonHistoryRecord = {
    seasonId: state.seasonRank.currentSeasonId,
    seasonNumber: parseInt(state.seasonRank.currentSeasonId.split("-")[1] ?? "1", 10),
    label: state.seasonRank.currentSeasonLabel,
    finalTier: state.seasonRank.tier,
    finalDivision: state.seasonRank.division,
    finalSr: state.seasonRank.sr,
    peakTier: state.seasonRank.seasonalPeakTier,
    peakDivision: state.seasonRank.seasonalPeakDivision,
    completedAt: timestamp,
  };

  // 2. Append to history only if not already recorded (no duplicates on skipped months)
  const existingHistory = state.seasonRank.history;
  const historyAlreadyContains = existingHistory.some(
    (h) => h.seasonId === completedRecord.seasonId
  );
  const nextHistory = historyAlreadyContains
    ? existingHistory
    : [completedRecord, ...existingHistory];

  // 3. Seed user 2 divisions below final rank
  const seededRung = calculateSeededRank(state.seasonRank.tier, state.seasonRank.division);

  const previousSeasonSummary: PreviousSeasonSummary = {
    seasonId: completedRecord.seasonId,
    label: completedRecord.label,
    finalTier: completedRecord.finalTier,
    finalDivision: completedRecord.finalDivision,
    finalSr: completedRecord.finalSr,
  };

  // Preserve all-time peak
  let allTimePeakTier = state.seasonRank.allTimePeakTier;
  let allTimePeakDivision = state.seasonRank.allTimePeakDivision;
  if (compareRanks(seededRung.tier, seededRung.division, allTimePeakTier, allTimePeakDivision) > 0) {
    allTimePeakTier = seededRung.tier;
    allTimePeakDivision = seededRung.division;
  }

  const nextSeasonRank: SeasonRankState = {
    currentSeasonId: activeSeasonId,
    currentSeasonLabel: formatSeasonLabel(activeSeasonId),
    tier: seededRung.tier,
    division: seededRung.division,
    sr: 0,
    seasonalPeakTier: seededRung.tier,
    seasonalPeakDivision: seededRung.division,
    allTimePeakTier,
    allTimePeakDivision,
    provisionalActivitiesCount: 0,
    isProvisional: true,
    weeklyMission: createWeeklyMission(currentWeekKey),
    dailyCaps: {
      date: localDate,
      taskSrEarned: 0,
      habitSrEarned: 0,
      focusSrEarned: 0,
    },
    evidence: {
      creditedActivityIds: [],
      qualifyingSessionTimestamps: [],
      activeCalendarDates: [],
      claimedWeeklyMissionKeys: [],
    },
    history: nextHistory,
    previousSeasonSummary,
  };

  return {
    nextState: {
      ...state,
      seasonRank: nextSeasonRank,
    },
    rolledOver: true,
    previousSeasonSummary,
  };
}
