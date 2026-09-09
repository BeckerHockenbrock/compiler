/**
 * Migration 1 -> 2: Attach Season Rank State
 *
 * Upgrades AppState from version 1 to version 2 by introducing the
 * seasonal Ranked system state while fully preserving all existing XP,
 * level, tasks, habits, stats, skills, logs, and settings.
 */

import type { AppState } from "@/domain/types";
import { createInitialSeasonRankState } from "@/domain/season-rank";
import { nowUtc } from "@/domain/date-time";

/**
 * Resolves the user's active timezone upon migration from v1.
 * If the user retained the old v1 default of "UTC", we detect and adopt their
 * browser timezone so monthly rollovers execute on the 1st of each month in
 * their actual local timezone. Explicit custom timezones other than "UTC" are preserved.
 */
export function resolveUserTimeZone(existingTimeZone?: unknown): string {
  let detected = "";
  try {
    if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  } catch {
    detected = "";
  }

  // Preserve explicit non-UTC custom configuration
  if (typeof existingTimeZone === "string" && existingTimeZone.length > 0 && existingTimeZone !== "UTC") {
    return existingTimeZone;
  }

  // Adopt browser timezone; fallback to "UTC" if unresolvable
  return detected || "UTC";
}

export function migrateV1ToV2(previousState: unknown): AppState {
  if (typeof previousState !== "object" || previousState === null) {
    throw new Error("Invalid v1 state: expected non-null object");
  }

  const v1 = previousState as Record<string, unknown>;
  const v1Settings = (v1.settings as Record<string, unknown>) ?? {};
  const effectiveTimeZone = resolveUserTimeZone(v1Settings.timeZone);

  const updatedSettings = {
    ...v1Settings,
    timeZone: effectiveTimeZone,
  };
  const timestamp = nowUtc();

  // If seasonRank already exists (e.g. from an in-memory draft), keep it; otherwise initialize
  const existingSeasonRank = v1.seasonRank;
  const seasonRank =
    typeof existingSeasonRank === "object" && existingSeasonRank !== null
      ? existingSeasonRank
      : createInitialSeasonRankState(timestamp, effectiveTimeZone);

  return {
    ...(v1 as unknown as AppState),
    settings: updatedSettings as AppState["settings"],
    seasonRank: seasonRank as AppState["seasonRank"],
  };
}
