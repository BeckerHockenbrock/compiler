/**
 * Study Timer Domain Engine
 *
 * Framework-free, pure state transitions and timestamp-derived calculations
 * for the local-first study timer. Zero dependencies on React, DOM APIs,
 * or browser storage.
 */

import type {
  AppState,
  StudyTimerState,
  StudyTimerDurationMinutes,
  StudyTimerActionResult,
  CompletedStudySessionSummary,
  ActivityReward,
} from "./types";
import { nowUtc } from "./date-time";
import { applyActivityReward } from "./progression";
import {
  applyActivityToSeasonRank,
  checkAndApplySeasonRollover,
} from "./season-rank";

/* ------------------------------------------------------------------ */
/* Reward Constants & Tunable Configuration                           */
/* ------------------------------------------------------------------ */

export const FOCUS_BLOCK_MINUTES = 25;
export const FOCUS_XP_PER_BLOCK = 25;
export const FOCUS_STAT_REWARDS_PER_BLOCK = {
  discipline: 2,
  knowledge: 3,
  focus: 3,
} as const;

export const FOCUS_DURATION_PRESETS: readonly StudyTimerDurationMinutes[] = [
  25, 50, 75,
] as const;

/* ------------------------------------------------------------------ */
/* Pure Initialization & Derived State                                */
/* ------------------------------------------------------------------ */

export function createInitialStudyTimerState(
  durationMinutes: StudyTimerDurationMinutes = 25
): StudyTimerState {
  return {
    status: "idle",
    sessionId: null,
    durationMinutes,
    segmentStartedAt: null,
    accumulatedElapsedMs: 0,
    lastCompletedSessionId: null,
  };
}

export interface DerivedTimerState {
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly totalTargetMs: number;
  readonly isCompleted: boolean;
  readonly progressRatio: number;
}

/**
 * Derives elapsed and remaining milliseconds from absolute UTC timestamps.
 * Immunity against tab throttling, sleeping machines, and background pausing:
 * elapsed time is never decremented or tracked in increments, but calculated
 * on demand from wall-clock timestamps.
 */
export function getDerivedTimerState(
  timer: StudyTimerState,
  nowIso: string = nowUtc()
): DerivedTimerState {
  const totalTargetMs = timer.durationMinutes * 60 * 1000;

  if (timer.status === "idle") {
    return {
      elapsedMs: 0,
      remainingMs: totalTargetMs,
      totalTargetMs,
      isCompleted: false,
      progressRatio: 0,
    };
  }

  let totalElapsedMs = timer.accumulatedElapsedMs;

  if (timer.status === "running" && timer.segmentStartedAt) {
    const segmentStartMs = Date.parse(timer.segmentStartedAt);
    const nowMs = Date.parse(nowIso);
    // Backward clock protection: if device clock jumps back, segment elapsed is non-negative
    const segmentElapsedMs = Math.max(0, nowMs - segmentStartMs);
    totalElapsedMs += segmentElapsedMs;
  }

  const safeElapsedMs = Math.min(totalTargetMs, Math.max(0, totalElapsedMs));
  const remainingMs = Math.max(0, totalTargetMs - safeElapsedMs);
  const isCompleted = totalElapsedMs >= totalTargetMs;
  const progressRatio =
    totalTargetMs > 0 ? Math.min(1, safeElapsedMs / totalTargetMs) : 0;

  return {
    elapsedMs: safeElapsedMs,
    remainingMs,
    totalTargetMs,
    isCompleted,
    progressRatio,
  };
}

/**
 * Formats remaining milliseconds into a human-readable MM:SS string.
 */
export function formatTimeRemaining(remainingMs: number): string {
  const safeMs = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const padMin = String(minutes).padStart(2, "0");
  const padSec = String(seconds).padStart(2, "0");
  return `${padMin}:${padSec}`;
}

/* ------------------------------------------------------------------ */
/* Pure State Transitions                                             */
/* ------------------------------------------------------------------ */

/**
 * Starts a new study session with the specified duration preset.
 */
export function startStudyTimer(
  timer: StudyTimerState,
  durationMinutes: StudyTimerDurationMinutes,
  nowIso: string = nowUtc(),
  sessionId?: string
): StudyTimerState {
  const generatedId =
    sessionId ??
    `session_${Date.parse(nowIso)}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    status: "running",
    sessionId: generatedId,
    durationMinutes,
    segmentStartedAt: nowIso,
    accumulatedElapsedMs: 0,
    lastCompletedSessionId: timer.lastCompletedSessionId ?? null,
  };
}

/**
 * Pauses a running study session, accumulating the elapsed time for the segment.
 */
export function pauseStudyTimer(
  timer: StudyTimerState,
  nowIso: string = nowUtc()
): StudyTimerState {
  if (timer.status !== "running") {
    return timer;
  }

  const totalTargetMs = timer.durationMinutes * 60 * 1000;
  const segmentStartMs = timer.segmentStartedAt
    ? Date.parse(timer.segmentStartedAt)
    : Date.parse(nowIso);
  const nowMs = Date.parse(nowIso);
  const segmentElapsedMs = Math.max(0, nowMs - segmentStartMs);
  const newAccumulatedMs = Math.min(
    totalTargetMs,
    timer.accumulatedElapsedMs + segmentElapsedMs
  );

  return {
    ...timer,
    status: "paused",
    segmentStartedAt: null,
    accumulatedElapsedMs: newAccumulatedMs,
  };
}

/**
 * Resumes a paused study session from its accumulated elapsed time.
 */
export function resumeStudyTimer(
  timer: StudyTimerState,
  nowIso: string = nowUtc()
): StudyTimerState {
  if (timer.status !== "paused") {
    return timer;
  }

  const totalTargetMs = timer.durationMinutes * 60 * 1000;
  if (timer.accumulatedElapsedMs >= totalTargetMs) {
    // Already completed; cannot resume
    return timer;
  }

  return {
    ...timer,
    status: "running",
    segmentStartedAt: nowIso,
  };
}

/**
 * Cancels an active or paused study session.
 * Partial sessions receive zero XP, stats, SR, or logs.
 */
export function cancelStudyTimer(timer: StudyTimerState): StudyTimerState {
  return {
    status: "idle",
    sessionId: null,
    durationMinutes: timer.durationMinutes,
    segmentStartedAt: null,
    accumulatedElapsedMs: 0,
    lastCompletedSessionId: timer.lastCompletedSessionId ?? null,
  };
}

/**
 * Sets duration preset while timer is idle.
 */
export function setStudyTimerDuration(
  timer: StudyTimerState,
  durationMinutes: StudyTimerDurationMinutes
): StudyTimerState {
  if (timer.status !== "idle") {
    return timer;
  }
  return {
    ...timer,
    durationMinutes,
  };
}

/* ------------------------------------------------------------------ */
/* Pure Session Completion & Reconciliation                           */
/* ------------------------------------------------------------------ */

export interface CompleteSessionResult {
  readonly nextState: AppState;
  readonly sessionCompleted: boolean;
  readonly summary?: CompletedStudySessionSummary;
}

/**
 * Pure state transition: completes an elapsed study session exactly once.
 * Guarantees:
 * - Strict idempotency (duplicate calls, double clicks, reloads are no-ops)
 * - Monthly rollover is reconciled BEFORE crediting rewards
 * - Permanent progression (+25 XP, +2 Dis, +3 Know, +3 Focus per 25-min block)
 * - Exactly one ActivityLog created for the completed session
 * - Season Rank scored via pure applyActivityToSeasonRank per block (+10 SR, 40 SR/day cap)
 * - Resets timer to idle with lastCompletedSessionId recorded
 */
export function completeStudyTimerSession(
  state: AppState,
  nowIso: string = nowUtc()
): CompleteSessionResult {
  const timer = state.studyTimer;

  // 1. Idempotency guards
  if (timer.status === "idle" || !timer.sessionId) {
    return { nextState: state, sessionCompleted: false };
  }

  // Prevent duplicate completion if already recorded
  if (timer.sessionId === timer.lastCompletedSessionId) {
    return {
      nextState: {
        ...state,
        studyTimer: {
          ...timer,
          status: "idle",
          sessionId: null,
          segmentStartedAt: null,
          accumulatedElapsedMs: 0,
        },
      },
      sessionCompleted: false,
    };
  }

  // Verify timer has actually completed its duration
  const derived = getDerivedTimerState(timer, nowIso);
  if (!derived.isCompleted) {
    return { nextState: state, sessionCompleted: false };
  }

  const sessionId = timer.sessionId;
  const durationMinutes = timer.durationMinutes;

  // 2. Reconcile monthly rollover FIRST using the completion timestamp
  // Ensures cross-midnight or new-month completions credit the correct season
  const userTimeZone = state.settings.timeZone ?? "UTC";
  const rollover = checkAndApplySeasonRollover(state, nowIso, userTimeZone);
  const stateToCredit = rollover.rolledOver ? rollover.nextState : state;

  // 3. Compute rewards based on completed 25-minute blocks
  const numBlocks = Math.max(1, Math.floor(durationMinutes / FOCUS_BLOCK_MINUTES));
  const earnedXp = numBlocks * FOCUS_XP_PER_BLOCK;
  const statRewards: Record<string, number> = {
    discipline: numBlocks * FOCUS_STAT_REWARDS_PER_BLOCK.discipline,
    knowledge: numBlocks * FOCUS_STAT_REWARDS_PER_BLOCK.knowledge,
    focus: numBlocks * FOCUS_STAT_REWARDS_PER_BLOCK.focus,
  };

  // 4. Apply permanent progression reward (creates ONE ActivityLog)
  const activityReward: ActivityReward = {
    type: "focus",
    referenceId: sessionId,
    title: `Completed study session · ${durationMinutes} min`,
    xp: earnedXp,
    statRewards,
    timestamp: nowIso,
  };

  const progressionResult = applyActivityReward(stateToCredit, activityReward);
  let nextState = progressionResult.nextState;

  // 5. Apply Season Rank scoring using the pure applyActivityToSeasonRank boundary
  // Called once for each completed 25-minute block with deterministic block IDs
  let totalSrEarned = 0;
  let finalPromoted = false;
  let finalTier = nextState.seasonRank.tier;
  let finalDivision = nextState.seasonRank.division;

  for (let blockIndex = 1; blockIndex <= numBlocks; blockIndex += 1) {
    const blockActivityId = `${sessionId}_block_${blockIndex}`;
    const rankResult = applyActivityToSeasonRank(
      nextState.seasonRank,
      blockActivityId,
      "focus",
      nowIso,
      userTimeZone
    );

    totalSrEarned += rankResult.srEarned;
    if (rankResult.promoted) {
      finalPromoted = true;
      finalTier = rankResult.newTier;
      finalDivision = rankResult.newDivision;
    }

    nextState = {
      ...nextState,
      seasonRank: rankResult.nextSeasonRank,
    };
  }

  // 6. Reset timer state to idle and record completed sessionId
  const completedTimer: StudyTimerState = {
    status: "idle",
    sessionId: null,
    durationMinutes,
    segmentStartedAt: null,
    accumulatedElapsedMs: 0,
    lastCompletedSessionId: sessionId,
  };

  nextState = {
    ...nextState,
    studyTimer: completedTimer,
  };

  const summary: CompletedStudySessionSummary = {
    sessionId,
    durationMinutes,
    completedAt: nowIso,
    xpEarned: earnedXp,
    srEarned: totalSrEarned,
    statDeltas: statRewards,
    levelUpOccurred: progressionResult.levelUpOccurred,
    newLevel: progressionResult.newLevel,
    promoted: finalPromoted,
    newTier: finalTier,
    newDivision: finalDivision,
  };

  return {
    nextState,
    sessionCompleted: true,
    summary,
  };
}

/**
 * Checks if active session has reached completion and reconciles it.
 * If timer is idle or still has time remaining, returns state unchanged.
 */
export function reconcileStudyTimer(
  state: AppState,
  nowIso: string = nowUtc()
): CompleteSessionResult {
  const timer = state.studyTimer;
  if (timer.status === "idle" || !timer.sessionId) {
    return { nextState: state, sessionCompleted: false };
  }

  const derived = getDerivedTimerState(timer, nowIso);
  if (derived.isCompleted) {
    return completeStudyTimerSession(state, nowIso);
  }

  return { nextState: state, sessionCompleted: false };
}

/* ------------------------------------------------------------------ */
/* Reconciliation-Aware Mutation Functions                            */
/* ------------------------------------------------------------------ */

export interface StudyTimerMutationResult {
  readonly nextState: AppState;
  readonly result: StudyTimerActionResult;
  readonly summary?: CompletedStudySessionSummary;
}

/**
 * Reconciles and cancels an active study timer.
 * If the timer has expired while backgrounded/away, settles the completed session
 * and awards legitimate XP/SR with result "completed".
 * If the timer still has remaining time, cancels it with zero rewards and result "normal".
 * If the timer is idle, returns "noop".
 */
export function cancelStudyTimerWithReconciliation(
  state: AppState,
  nowIso: string = nowUtc()
): StudyTimerMutationResult {
  // 1. Reconcile first to check if the session expired
  const timerRec = reconcileStudyTimer(state, nowIso);
  if (timerRec.sessionCompleted && timerRec.summary) {
    return {
      nextState: timerRec.nextState,
      result: "completed",
      summary: timerRec.summary,
    };
  }

  // 2. Only cancel when the timer is currently running or paused with remaining time
  if (state.studyTimer.status !== "running" && state.studyTimer.status !== "paused") {
    return {
      nextState: state,
      result: "noop",
    };
  }

  const nextTimer = cancelStudyTimer(state.studyTimer);
  return {
    nextState: {
      ...state,
      studyTimer: nextTimer,
    },
    result: "normal",
  };
}

/**
 * Reconciles and pauses a running study timer.
 * If the timer has expired, settles the completed session with result "completed".
 * If running with time remaining, pauses it with result "normal".
 * Otherwise returns "noop".
 */
export function pauseStudyTimerWithReconciliation(
  state: AppState,
  nowIso: string = nowUtc()
): StudyTimerMutationResult {
  const timerRec = reconcileStudyTimer(state, nowIso);
  if (timerRec.sessionCompleted && timerRec.summary) {
    return {
      nextState: timerRec.nextState,
      result: "completed",
      summary: timerRec.summary,
    };
  }

  if (state.studyTimer.status !== "running") {
    return {
      nextState: state,
      result: "noop",
    };
  }

  const nextTimer = pauseStudyTimer(state.studyTimer, nowIso);
  return {
    nextState: {
      ...state,
      studyTimer: nextTimer,
    },
    result: "normal",
  };
}

/**
 * Reconciles and resumes a paused study timer.
 * If the timer has expired, settles the completed session with result "completed".
 * If paused with time remaining, resumes it with result "normal".
 * Otherwise returns "noop".
 */
export function resumeStudyTimerWithReconciliation(
  state: AppState,
  nowIso: string = nowUtc()
): StudyTimerMutationResult {
  const timerRec = reconcileStudyTimer(state, nowIso);
  if (timerRec.sessionCompleted && timerRec.summary) {
    return {
      nextState: timerRec.nextState,
      result: "completed",
      summary: timerRec.summary,
    };
  }

  if (state.studyTimer.status !== "paused") {
    return {
      nextState: state,
      result: "noop",
    };
  }

  const nextTimer = resumeStudyTimer(state.studyTimer, nowIso);
  return {
    nextState: {
      ...state,
      studyTimer: nextTimer,
    },
    result: "normal",
  };
}

/**
 * Reconciles and starts a new study timer.
 * Cannot overwrite an active running or paused timer.
 * Reconciles first; if a previous session completed, settles it.
 * Then only starts when the resulting timer is idle.
 */
export function startStudyTimerWithReconciliation(
  state: AppState,
  durationMinutes: StudyTimerDurationMinutes,
  nowIso: string = nowUtc()
): StudyTimerMutationResult {
  const timerRec = reconcileStudyTimer(state, nowIso);
  const baseState = timerRec.sessionCompleted ? timerRec.nextState : state;
  const completedSummary = timerRec.sessionCompleted ? timerRec.summary : undefined;

  // Cannot overwrite an active timer (running or paused with remaining time)
  if (baseState.studyTimer.status !== "idle") {
    return {
      nextState: baseState,
      result: "noop",
      summary: completedSummary,
    };
  }

  const nextTimer = startStudyTimer(baseState.studyTimer, durationMinutes, nowIso);
  return {
    nextState: {
      ...baseState,
      studyTimer: nextTimer,
    },
    result: "normal",
    summary: completedSummary,
  };
}

