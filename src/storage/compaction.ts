/**
 * Log Retention & Compaction Policy
 *
 * Core Principles:
 * 1. Independence of Aggregates:
 *    Lifetime progress (total XP, current level, available skill points,
 *    stat lifetime values, skill XP, and habit streak records) is stored
 *    permanently in primary domain state fields.
 *    Detailed ActivityLog items are secondary history records.
 * 2. User-Visible & Transparent:
 *    The system does NOT silently delete user logs. Instead, it measures log volume
 *    against settings.maxLogRetention, exposes a status check for the UI,
 *    and provides an explicit compaction routine that safely prunes the oldest
 *    granular logs while leaving all aggregates completely intact.
 */

import type { AppState } from "@/domain/types";

export interface CompactionReport {
  readonly previousLogCount: number;
  readonly newLogCount: number;
  readonly prunedCount: number;
}

export interface RetentionStatus {
  readonly isOverLimit: boolean;
  readonly currentCount: number;
  readonly maxRetention: number;
}

/**
 * Checks whether current log count exceeds user settings retention limit.
 */
export function checkRetentionStatus(state: AppState): RetentionStatus {
  const currentCount = state.activityLogs.length;
  const maxRetention = state.settings.maxLogRetention;
  return {
    isOverLimit: currentCount > maxRetention,
    currentCount,
    maxRetention,
  };
}

/**
 * Compacts activity logs by keeping the N most recent entries (defaulting to settings.maxLogRetention).
 * All progression aggregates, stats, habits, and tasks remain completely untouched.
 */
export function compactActivityLogs(
  state: AppState,
  overrideMaxEntries?: number
): { compactedState: AppState; report: CompactionReport } {
  const maxEntries = overrideMaxEntries ?? state.settings.maxLogRetention;
  const previousLogCount = state.activityLogs.length;

  if (previousLogCount <= maxEntries) {
    return {
      compactedState: state,
      report: {
        previousLogCount,
        newLogCount: previousLogCount,
        prunedCount: 0,
      },
    };
  }

  // Preserve the most recent maxEntries (logs are sorted newest first)
  const prunedLogs = state.activityLogs.slice(0, maxEntries);
  const prunedCount = previousLogCount - prunedLogs.length;

  const compactedState: AppState = {
    ...state,
    activityLogs: prunedLogs,
  };

  return {
    compactedState,
    report: {
      previousLogCount,
      newLogCount: prunedLogs.length,
      prunedCount,
    },
  };
}
