/**
 * Migration 2 -> 3: Attach Study Timer State
 *
 * Upgrades AppState from version 2 to version 3 by introducing the
 * study timer state while fully preserving all existing XP,
 * level, tasks, habits, stats, skills, logs, settings, and seasonRank.
 */

import type { AppState } from "@/domain/types";
import { createInitialStudyTimerState } from "@/domain/study-timer";

export function migrateV2ToV3(previousState: unknown): AppState {
  if (typeof previousState !== "object" || previousState === null) {
    throw new Error("Invalid v2 state: expected non-null object");
  }

  const v2 = previousState as Record<string, unknown>;

  // If studyTimer already exists (e.g. from an in-memory draft), keep it; otherwise initialize
  const existingStudyTimer = v2.studyTimer;
  const studyTimer =
    typeof existingStudyTimer === "object" && existingStudyTimer !== null
      ? existingStudyTimer
      : createInitialStudyTimerState();

  return {
    ...(v2 as unknown as AppState),
    studyTimer: studyTimer as AppState["studyTimer"],
  };
}
