import { describe, it, expect } from "vitest";
import {
  createInitialStudyTimerState,
  getDerivedTimerState,
  formatTimeRemaining,
  startStudyTimer,
  pauseStudyTimer,
  resumeStudyTimer,
  cancelStudyTimer,
  setStudyTimerDuration,
  completeStudyTimerSession,
  reconcileStudyTimer,
  startStudyTimerWithReconciliation,
  pauseStudyTimerWithReconciliation,
  resumeStudyTimerWithReconciliation,
  cancelStudyTimerWithReconciliation,
} from "@/domain/study-timer";
import { createInitialAppState } from "@/domain/defaults";
import type { AppState } from "@/domain/types";

describe("Domain: Study Timer Engine", () => {
  describe("Initialization & Duration Presets", () => {
    it("creates initial idle timer with 25-minute default", () => {
      const timer = createInitialStudyTimerState();
      expect(timer.status).toBe("idle");
      expect(timer.sessionId).toBeNull();
      expect(timer.durationMinutes).toBe(25);
      expect(timer.segmentStartedAt).toBeNull();
      expect(timer.accumulatedElapsedMs).toBe(0);
      expect(timer.lastCompletedSessionId).toBeNull();
    });

    it("allows selecting duration presets only while idle", () => {
      let timer = createInitialStudyTimerState(25);
      timer = setStudyTimerDuration(timer, 50);
      expect(timer.durationMinutes).toBe(50);

      timer = setStudyTimerDuration(timer, 75);
      expect(timer.durationMinutes).toBe(75);

      // Start timer: now running
      timer = startStudyTimer(timer, 75, "2026-09-12T10:00:00.000Z");
      expect(timer.status).toBe("running");

      // Attempting to change duration while running is ignored
      timer = setStudyTimerDuration(timer, 25);
      expect(timer.durationMinutes).toBe(75);
    });

    it("formats remaining milliseconds into MM:SS correctly", () => {
      expect(formatTimeRemaining(25 * 60 * 1000)).toBe("25:00");
      expect(formatTimeRemaining(50 * 60 * 1000)).toBe("50:00");
      expect(formatTimeRemaining(75 * 60 * 1000)).toBe("75:00");
      expect(formatTimeRemaining(4 * 60 * 1000 + 9 * 1000)).toBe("04:09");
      expect(formatTimeRemaining(59 * 1000)).toBe("00:59");
      expect(formatTimeRemaining(0)).toBe("00:00");
      expect(formatTimeRemaining(-5000)).toBe("00:00");
    });
  });

  describe("Elapsed-Time Math and Timestamp Derivation", () => {
    it("derives zero elapsed and full remaining time when idle", () => {
      const timer = createInitialStudyTimerState(25);
      const derived = getDerivedTimerState(timer, "2026-09-12T10:00:00.000Z");
      expect(derived.elapsedMs).toBe(0);
      expect(derived.remainingMs).toBe(25 * 60 * 1000);
      expect(derived.isCompleted).toBe(false);
      expect(derived.progressRatio).toBe(0);
    });

    it("derives elapsed time accurately across active running segments using absolute timestamps", () => {
      let timer = createInitialStudyTimerState(25);
      const startIso = "2026-09-12T10:00:00.000Z";
      timer = startStudyTimer(timer, 25, startIso);

      // 10 minutes later
      const tenMinutesLater = "2026-09-12T10:10:00.000Z";
      const derived10 = getDerivedTimerState(timer, tenMinutesLater);
      expect(derived10.elapsedMs).toBe(10 * 60 * 1000);
      expect(derived10.remainingMs).toBe(15 * 60 * 1000);
      expect(derived10.isCompleted).toBe(false);
      expect(derived10.progressRatio).toBeCloseTo(10 / 25, 4);

      // 25 minutes later (completed)
      const completeIso = "2026-09-12T10:25:00.000Z";
      const derived25 = getDerivedTimerState(timer, completeIso);
      expect(derived25.elapsedMs).toBe(25 * 60 * 1000);
      expect(derived25.remainingMs).toBe(0);
      expect(derived25.isCompleted).toBe(true);
      expect(derived25.progressRatio).toBe(1);

      // 30 minutes later (beyond target: clamped safely)
      const thirtyMinutesLater = "2026-09-12T10:30:00.000Z";
      const derived30 = getDerivedTimerState(timer, thirtyMinutesLater);
      expect(derived30.elapsedMs).toBe(25 * 60 * 1000);
      expect(derived30.remainingMs).toBe(0);
      expect(derived30.isCompleted).toBe(true);
    });

    it("pauses and resumes without drift or elapsed-time loss", () => {
      let timer = createInitialStudyTimerState(50);
      const startIso = "2026-09-12T10:00:00.000Z";
      timer = startStudyTimer(timer, 50, startIso);

      // Run for 15 minutes, then pause
      const pauseIso = "2026-09-12T10:15:00.000Z";
      timer = pauseStudyTimer(timer, pauseIso);
      expect(timer.status).toBe("paused");
      expect(timer.accumulatedElapsedMs).toBe(15 * 60 * 1000);
      expect(timer.segmentStartedAt).toBeNull();

      // While paused, 2 hours pass in real world (e.g. computer asleep or user away)
      const twoHoursLater = "2026-09-12T12:15:00.000Z";
      const derivedPaused = getDerivedTimerState(timer, twoHoursLater);
      // Paused timer must strictly retain 15 minutes elapsed!
      expect(derivedPaused.elapsedMs).toBe(15 * 60 * 1000);
      expect(derivedPaused.remainingMs).toBe(35 * 60 * 1000);
      expect(derivedPaused.isCompleted).toBe(false);

      // Resume timer at 12:15:00
      timer = resumeStudyTimer(timer, twoHoursLater);
      expect(timer.status).toBe("running");
      expect(timer.segmentStartedAt).toBe(twoHoursLater);
      expect(timer.accumulatedElapsedMs).toBe(15 * 60 * 1000);

      // Run for another 20 minutes (total 35 minutes elapsed)
      const resumeCheckIso = "2026-09-12T12:35:00.000Z";
      const derivedResumed = getDerivedTimerState(timer, resumeCheckIso);
      expect(derivedResumed.elapsedMs).toBe(35 * 60 * 1000);
      expect(derivedResumed.remainingMs).toBe(15 * 60 * 1000);
      expect(derivedResumed.isCompleted).toBe(false);

      // Complete the remaining 15 minutes
      const finalIso = "2026-09-12T12:50:00.000Z";
      const derivedFinal = getDerivedTimerState(timer, finalIso);
      expect(derivedFinal.elapsedMs).toBe(50 * 60 * 1000);
      expect(derivedFinal.remainingMs).toBe(0);
      expect(derivedFinal.isCompleted).toBe(true);
    });

    it("guards gracefully against backward device clock jumps", () => {
      let timer = createInitialStudyTimerState(25);
      const startIso = "2026-09-12T10:00:00.000Z";
      timer = startStudyTimer(timer, 25, startIso);

      // Clock jumped backward 5 minutes
      const backwardIso = "2026-09-12T09:55:00.000Z";
      const derived = getDerivedTimerState(timer, backwardIso);
      expect(derived.elapsedMs).toBe(0);
      expect(derived.remainingMs).toBe(25 * 60 * 1000);
      expect(derived.isCompleted).toBe(false);
    });
  });

  describe("Session Cancellation", () => {
    it("cancels running session with zero rewards, logs, or Season Rank changes", () => {
      const initialApp = createInitialAppState();
      let timer = initialApp.studyTimer;
      const startIso = "2026-09-12T10:00:00.000Z";
      timer = startStudyTimer(timer, 50, startIso);

      const stateRunning: AppState = { ...initialApp, studyTimer: timer };
      const cancelledTimer = cancelStudyTimer(stateRunning.studyTimer);

      expect(cancelledTimer.status).toBe("idle");
      expect(cancelledTimer.sessionId).toBeNull();
      expect(cancelledTimer.segmentStartedAt).toBeNull();
      expect(cancelledTimer.accumulatedElapsedMs).toBe(0);
      expect(cancelledTimer.durationMinutes).toBe(50); // Preserves preset

      const stateCancelled: AppState = { ...stateRunning, studyTimer: cancelledTimer };
      expect(stateCancelled.progression.totalXp).toBe(0);
      expect(stateCancelled.activityLogs.length).toBe(0);
      expect(stateCancelled.seasonRank.sr).toBe(0);
    });

    it("cancels paused session with zero rewards", () => {
      let timer = createInitialStudyTimerState(25);
      timer = startStudyTimer(timer, 25, "2026-09-12T10:00:00.000Z");
      timer = pauseStudyTimer(timer, "2026-09-12T10:15:00.000Z");
      expect(timer.status).toBe("paused");

      timer = cancelStudyTimer(timer);
      expect(timer.status).toBe("idle");
      expect(timer.sessionId).toBeNull();
      expect(timer.accumulatedElapsedMs).toBe(0);
    });
  });

  describe("Completion Rewards for 25, 50, and 75 Minutes", () => {
    it("completes a 25-minute session granting 25 XP, Dis+2, Know+3, Focus+3, 10 SR, and one activity log", () => {
      const app = createInitialAppState();
      const startIso = "2026-09-12T10:00:00.000Z";
      const endIso = "2026-09-12T10:25:00.000Z";

      const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_25");
      const runningApp: AppState = { ...app, studyTimer: runningTimer };

      const { nextState, sessionCompleted, summary } = completeStudyTimerSession(
        runningApp,
        endIso
      );

      expect(sessionCompleted).toBe(true);
      expect(summary).toBeDefined();
      expect(summary?.durationMinutes).toBe(25);
      expect(summary?.xpEarned).toBe(25);
      expect(summary?.srEarned).toBe(10);
      expect(summary?.statDeltas).toEqual({ discipline: 2, knowledge: 3, focus: 3 });

      // Verify permanent progression
      expect(nextState.progression.totalXp).toBe(25);
      expect(nextState.stats.discipline?.current).toBe(2);
      expect(nextState.stats.discipline?.lifetimeEarned).toBe(2);
      expect(nextState.stats.knowledge?.current).toBe(3);
      expect(nextState.stats.focus?.current).toBe(3);

      // Verify single activity log with type focus
      expect(nextState.activityLogs.length).toBe(1);
      const log = nextState.activityLogs[0];
      expect(log.type).toBe("focus");
      expect(log.title).toBe("Completed study session · 25 min");
      expect(log.xpEarned).toBe(25);
      expect(log.referenceId).toBe("sess_25");

      // Verify Season Rank scoring boundary
      expect(nextState.seasonRank.sr).toBe(10);
      expect(nextState.seasonRank.dailyCaps.focusSrEarned).toBe(10);
      expect(nextState.seasonRank.evidence.creditedActivityIds).toContain("sess_25_block_1");

      // Verify timer reset to idle
      expect(nextState.studyTimer.status).toBe("idle");
      expect(nextState.studyTimer.sessionId).toBeNull();
      expect(nextState.studyTimer.lastCompletedSessionId).toBe("sess_25");
    });

    it("completes a 50-minute session granting 50 XP, Dis+4, Know+6, Focus+6, 20 SR (2 blocks)", () => {
      const app = createInitialAppState();
      const startIso = "2026-09-12T10:00:00.000Z";
      const endIso = "2026-09-12T10:50:00.000Z";

      const runningTimer = startStudyTimer(app.studyTimer, 50, startIso, "sess_50");
      const runningApp: AppState = { ...app, studyTimer: runningTimer };

      const { nextState, sessionCompleted, summary } = completeStudyTimerSession(
        runningApp,
        endIso
      );

      expect(sessionCompleted).toBe(true);
      expect(summary?.xpEarned).toBe(50);
      expect(summary?.srEarned).toBe(20);
      expect(summary?.statDeltas).toEqual({ discipline: 4, knowledge: 6, focus: 6 });

      expect(nextState.progression.totalXp).toBe(50);
      expect(nextState.stats.discipline?.current).toBe(4);
      expect(nextState.stats.knowledge?.current).toBe(6);
      expect(nextState.stats.focus?.current).toBe(6);

      // Exactly one permanent activity log
      expect(nextState.activityLogs.length).toBe(1);
      expect(nextState.activityLogs[0].title).toBe("Completed study session · 50 min");

      // Season rank credited 2 blocks
      expect(nextState.seasonRank.sr).toBe(20);
      expect(nextState.seasonRank.dailyCaps.focusSrEarned).toBe(20);
      expect(nextState.seasonRank.evidence.creditedActivityIds).toContain("sess_50_block_1");
      expect(nextState.seasonRank.evidence.creditedActivityIds).toContain("sess_50_block_2");
    });

    it("completes a 75-minute session granting 75 XP, Dis+6, Know+9, Focus+9, 30 SR (3 blocks)", () => {
      const app = createInitialAppState();
      const startIso = "2026-09-12T10:00:00.000Z";
      const endIso = "2026-09-12T11:15:00.000Z";

      const runningTimer = startStudyTimer(app.studyTimer, 75, startIso, "sess_75");
      const runningApp: AppState = { ...app, studyTimer: runningTimer };

      const { nextState, sessionCompleted, summary } = completeStudyTimerSession(
        runningApp,
        endIso
      );

      expect(sessionCompleted).toBe(true);
      expect(summary?.xpEarned).toBe(75);
      expect(summary?.srEarned).toBe(30);
      expect(summary?.statDeltas).toEqual({ discipline: 6, knowledge: 9, focus: 9 });

      expect(nextState.progression.totalXp).toBe(75);
      expect(nextState.stats.discipline?.current).toBe(6);
      expect(nextState.stats.knowledge?.current).toBe(9);
      expect(nextState.stats.focus?.current).toBe(9);

      expect(nextState.activityLogs.length).toBe(1);
      expect(nextState.activityLogs[0].title).toBe("Completed study session · 75 min");

      expect(nextState.seasonRank.sr).toBe(30);
      expect(nextState.seasonRank.dailyCaps.focusSrEarned).toBe(30);
      expect(nextState.seasonRank.evidence.creditedActivityIds).toContain("sess_75_block_1");
      expect(nextState.seasonRank.evidence.creditedActivityIds).toContain("sess_75_block_2");
      expect(nextState.seasonRank.evidence.creditedActivityIds).toContain("sess_75_block_3");
    });
  });

  describe("Idempotency & Strict No-Op on Duplicate Completion", () => {
    it("prevents double-crediting if completeStudyTimerSession is invoked repeatedly", () => {
      const app = createInitialAppState();
      const startIso = "2026-09-12T10:00:00.000Z";
      const endIso = "2026-09-12T10:25:00.000Z";

      const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_idempotent");
      const runningApp: AppState = { ...app, studyTimer: runningTimer };

      // First completion call succeeds
      const first = completeStudyTimerSession(runningApp, endIso);
      expect(first.sessionCompleted).toBe(true);
      expect(first.nextState.progression.totalXp).toBe(25);
      expect(first.nextState.seasonRank.sr).toBe(10);
      expect(first.nextState.activityLogs.length).toBe(1);

      // Second completion call on the resulting state is a strict no-op
      const second = completeStudyTimerSession(first.nextState, endIso);
      expect(second.sessionCompleted).toBe(false);
      expect(second.nextState.progression.totalXp).toBe(25);
      expect(second.nextState.seasonRank.sr).toBe(10);
      expect(second.nextState.activityLogs.length).toBe(1);

      // Even if called with the original running state again, lastCompletedSessionId blocks re-awarding
      const third = completeStudyTimerSession(
        {
          ...runningApp,
          studyTimer: {
            ...runningApp.studyTimer,
            lastCompletedSessionId: "sess_idempotent",
          },
        },
        endIso
      );
      expect(third.sessionCompleted).toBe(false);
    });

    it("returns sessionCompleted: false when timer has not reached duration", () => {
      const app = createInitialAppState();
      const startIso = "2026-09-12T10:00:00.000Z";
      const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_early");
      const runningApp: AppState = { ...app, studyTimer: runningTimer };

      // Only 10 minutes have elapsed
      const earlyIso = "2026-09-12T10:10:00.000Z";
      const res = completeStudyTimerSession(runningApp, earlyIso);
      expect(res.sessionCompleted).toBe(false);
      expect(res.nextState.progression.totalXp).toBe(0);
      expect(res.nextState.activityLogs.length).toBe(0);
    });
  });

  describe("Daily Focus SR Cap (40 SR/day)", () => {
    it("enforces the 40 SR daily focus cap across multiple sessions on the same calendar day", () => {
      let state = createInitialAppState();
      const baseDate = "2026-09-12";
      // Pre-complete weekly mission so we isolate the daily focus SR cap
      state = {
        ...state,
        seasonRank: {
          ...state.seasonRank,
          weeklyMission: {
            ...state.seasonRank.weeklyMission,
            completed: true,
            currentCount: 5,
          },
          evidence: {
            ...state.seasonRank.evidence,
            claimedWeeklyMissionKeys: [state.seasonRank.weeklyMission.weekKey],
          },
        },
      };

      // Session 1 (25m): +10 SR (total: 10 SR)
      let timer = startStudyTimer(state.studyTimer, 25, `${baseDate}T09:00:00.000Z`, "s1");
      state = { ...state, studyTimer: timer };
      state = completeStudyTimerSession(state, `${baseDate}T09:25:00.000Z`).nextState;
      expect(state.seasonRank.dailyCaps.focusSrEarned).toBe(10);
      expect(state.seasonRank.sr).toBe(10);

      // Session 2 (25m): +10 SR (total: 20 SR)
      timer = startStudyTimer(state.studyTimer, 25, `${baseDate}T10:00:00.000Z`, "s2");
      state = { ...state, studyTimer: timer };
      state = completeStudyTimerSession(state, `${baseDate}T10:25:00.000Z`).nextState;
      expect(state.seasonRank.dailyCaps.focusSrEarned).toBe(20);
      expect(state.seasonRank.sr).toBe(20);

      // Session 3 (25m): +10 SR (total: 30 SR)
      timer = startStudyTimer(state.studyTimer, 25, `${baseDate}T11:00:00.000Z`, "s3");
      state = { ...state, studyTimer: timer };
      state = completeStudyTimerSession(state, `${baseDate}T11:25:00.000Z`).nextState;
      expect(state.seasonRank.dailyCaps.focusSrEarned).toBe(30);
      expect(state.seasonRank.sr).toBe(30);

      // Session 4 (25m): +10 SR (total: 40 SR - Cap reached!)
      timer = startStudyTimer(state.studyTimer, 25, `${baseDate}T12:00:00.000Z`, "s4");
      state = { ...state, studyTimer: timer };
      state = completeStudyTimerSession(state, `${baseDate}T12:25:00.000Z`).nextState;
      expect(state.seasonRank.dailyCaps.focusSrEarned).toBe(40);
      expect(state.seasonRank.sr).toBe(40);

      // Session 5 (25m): Grants permanent XP (+25) and stats, but 0 SR because 40 cap reached!
      timer = startStudyTimer(state.studyTimer, 25, `${baseDate}T13:00:00.000Z`, "s5");
      state = { ...state, studyTimer: timer };
      const res5 = completeStudyTimerSession(state, `${baseDate}T13:25:00.000Z`);
      expect(res5.sessionCompleted).toBe(true);
      expect(res5.summary?.srEarned).toBe(0);
      expect(res5.summary?.xpEarned).toBe(25);
      expect(res5.nextState.seasonRank.dailyCaps.focusSrEarned).toBe(40);
      expect(res5.nextState.seasonRank.sr).toBe(40); // SR unchanged
      expect(res5.nextState.progression.totalXp).toBe(125); // 5 * 25 XP
      expect(res5.nextState.activityLogs.length).toBe(5);
    });

    it("clamps partial SR correctly when a session crosses the remaining daily cap", () => {
      let state = createInitialAppState();
      const baseDate = "2026-09-12";
      // Pre-complete weekly mission so we isolate the daily focus SR cap
      state = {
        ...state,
        seasonRank: {
          ...state.seasonRank,
          weeklyMission: {
            ...state.seasonRank.weeklyMission,
            completed: true,
            currentCount: 5,
          },
          evidence: {
            ...state.seasonRank.evidence,
            claimedWeeklyMissionKeys: [state.seasonRank.weeklyMission.weekKey],
          },
        },
      };

      // Session 1 (75m = 3 blocks): awards 30 SR (leaving 10 SR available under 40 cap)
      let timer = startStudyTimer(state.studyTimer, 75, `${baseDate}T09:00:00.000Z`, "s75");
      state = { ...state, studyTimer: timer };
      state = completeStudyTimerSession(state, `${baseDate}T10:15:00.000Z`).nextState;
      expect(state.seasonRank.dailyCaps.focusSrEarned).toBe(30);
      expect(state.seasonRank.sr).toBe(30);

      // Session 2 (50m = 2 blocks = 20 SR potential): only 10 SR available
      timer = startStudyTimer(state.studyTimer, 50, `${baseDate}T11:00:00.000Z`, "s50");
      state = { ...state, studyTimer: timer };
      const res2 = completeStudyTimerSession(state, `${baseDate}T11:50:00.000Z`);
      expect(res2.sessionCompleted).toBe(true);
      expect(res2.summary?.srEarned).toBe(10); // Clamped from 20 to 10
      expect(res2.nextState.seasonRank.dailyCaps.focusSrEarned).toBe(40);
      expect(res2.nextState.seasonRank.sr).toBe(40);
      expect(res2.nextState.progression.totalXp).toBe(125); // 75 + 50
    });

    it("progresses and completes weekly Ranked mission via focus sessions", () => {
      let state = createInitialAppState();
      const baseDate = "2026-09-12";

      // 4 sessions (4 qualifying activities)
      for (let i = 1; i <= 4; i++) {
        const hour = String(i + 8).padStart(2, "0");
        const timer = startStudyTimer(state.studyTimer, 25, `${baseDate}T${hour}:00:00.000Z`, `wm_${i}`);
        state = completeStudyTimerSession({ ...state, studyTimer: timer }, `${baseDate}T${hour}:25:00.000Z`).nextState;
      }

      expect(state.seasonRank.weeklyMission.currentCount).toBe(4);
      expect(state.seasonRank.weeklyMission.completed).toBe(false);
      expect(state.seasonRank.sr).toBe(40);

      // 5th session: triggers weekly mission completion (+25 SR auto-claim)!
      const timer5 = startStudyTimer(state.studyTimer, 25, `${baseDate}T13:00:00.000Z`, "wm_5");
      const res5 = completeStudyTimerSession({ ...state, studyTimer: timer5 }, `${baseDate}T13:25:00.000Z`);

      expect(res5.sessionCompleted).toBe(true);
      // Focus daily cap was 40, so 0 focus SR + 25 weekly mission SR = 25 SR earned
      expect(res5.summary?.srEarned).toBe(25);
      expect(res5.nextState.seasonRank.weeklyMission.completed).toBe(true);
      expect(res5.nextState.seasonRank.sr).toBe(65); // 40 from focus + 25 from mission
    });
  });

  describe("Monthly Rollover Boundary Precedence", () => {
    it("credits session completed after midnight to the new month after reconciling rollover", () => {
      // Start in August 2026
      let state = createInitialAppState();
      state = {
        ...state,
        settings: { ...state.settings, timeZone: "UTC" },
        seasonRank: {
          ...state.seasonRank,
          currentSeasonId: "2026-08",
          currentSeasonLabel: "Season 08 · August 2026",
          sr: 70,
          tier: "bronze",
          division: "II",
        },
      };

      // Session starts Aug 31 at 23:45 UTC and finishes Sept 1 at 00:10 UTC (25m session)
      const startIso = "2026-08-31T23:45:00.000Z";
      const endIso = "2026-09-01T00:10:00.000Z";

      const timer = startStudyTimer(state.studyTimer, 25, startIso, "sess_cross_month");
      state = { ...state, studyTimer: timer };

      const { nextState, sessionCompleted, summary } = completeStudyTimerSession(
        state,
        endIso
      );

      expect(sessionCompleted).toBe(true);
      expect(summary?.xpEarned).toBe(25);
      expect(summary?.srEarned).toBe(10);

      // 1. August season should be archived in history
      expect(nextState.seasonRank.history.length).toBe(1);
      const archived = nextState.seasonRank.history[0];
      expect(archived.seasonId).toBe("2026-08");
      expect(archived.finalTier).toBe("bronze");
      expect(archived.finalDivision).toBe("II");
      expect(archived.finalSr).toBe(70);

      // 2. Active season must now be September 2026
      expect(nextState.seasonRank.currentSeasonId).toBe("2026-09");
      expect(nextState.seasonRank.currentSeasonLabel).toBe("Season 09 · September 2026");

      // 3. User soft reset from Bronze II (4) seeded 2 rungs down to Recruit I (2)
      expect(nextState.seasonRank.tier).toBe("recruit");
      expect(nextState.seasonRank.division).toBe("I");

      // 4. The 10 SR earned from the session completed at 00:10 Sept 1 must be credited to September!
      expect(nextState.seasonRank.sr).toBe(10);
      expect(nextState.seasonRank.dailyCaps.date).toBe("2026-09-01");
      expect(nextState.seasonRank.dailyCaps.focusSrEarned).toBe(10);

      // 5. Permanent XP and stats preserved
      expect(nextState.progression.totalXp).toBe(25);
      expect(nextState.activityLogs.length).toBe(1);
    });
  });

  describe("Visibility & Focus Reconciliation", () => {
    it("reconcileStudyTimer automatically completes an expired session", () => {
      const app = createInitialAppState();
      const startIso = "2026-09-12T10:00:00.000Z";
      const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_reconcile");
      const runningApp: AppState = { ...app, studyTimer: runningTimer };

      // App comes into focus 30 minutes later
      const focusIso = "2026-09-12T10:30:00.000Z";
      const res = reconcileStudyTimer(runningApp, focusIso);

      expect(res.sessionCompleted).toBe(true);
      expect(res.summary?.sessionId).toBe("sess_reconcile");
      expect(res.nextState.progression.totalXp).toBe(25);
      expect(res.nextState.studyTimer.status).toBe("idle");
    });

    it("reconcileStudyTimer leaves an unexpired session running and returns unchanged state", () => {
      const app = createInitialAppState();
      const startIso = "2026-09-12T10:00:00.000Z";
      const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_still_running");
      const runningApp: AppState = { ...app, studyTimer: runningTimer };

      // App comes into focus 10 minutes later
      const focusIso = "2026-09-12T10:10:00.000Z";
      const res = reconcileStudyTimer(runningApp, focusIso);

      expect(res.sessionCompleted).toBe(false);
      expect(res.nextState.studyTimer.status).toBe("running");
      expect(res.nextState.progression.totalXp).toBe(0);
    });
  });

  describe("Reconciliation-Aware Mutation Actions", () => {
    describe("cancelStudyTimerWithReconciliation", () => {
      it("cancelling an expired timer settles it and awards legitimate rewards rather than discarding it", () => {
        const app = createInitialAppState();
        const startIso = "2026-09-12T10:00:00.000Z";
        const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_expired_cancel");
        const runningApp: AppState = { ...app, studyTimer: runningTimer };

        // 30 minutes later (timer expired while backgrounded), user taps Cancel
        const cancelTime = "2026-09-12T10:30:00.000Z";
        const { nextState, result, summary } = cancelStudyTimerWithReconciliation(runningApp, cancelTime);

        expect(result).toBe("completed");
        expect(summary).toBeDefined();
        expect(summary?.sessionId).toBe("sess_expired_cancel");
        expect(summary?.xpEarned).toBe(25);
        expect(summary?.srEarned).toBe(10);
        expect(nextState.progression.totalXp).toBe(25);
        expect(nextState.seasonRank.sr).toBe(10);
        expect(nextState.activityLogs.length).toBe(1);
        expect(nextState.studyTimer.status).toBe("idle");
        expect(nextState.studyTimer.lastCompletedSessionId).toBe("sess_expired_cancel");
      });

      it("cancelling an active running timer with time remaining gives zero rewards and returns normal", () => {
        const app = createInitialAppState();
        const startIso = "2026-09-12T10:00:00.000Z";
        const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_active_cancel");
        const runningApp: AppState = { ...app, studyTimer: runningTimer };

        // 10 minutes later, user cancels active session
        const cancelTime = "2026-09-12T10:10:00.000Z";
        const { nextState, result, summary } = cancelStudyTimerWithReconciliation(runningApp, cancelTime);

        expect(result).toBe("normal");
        expect(summary).toBeUndefined();
        expect(nextState.progression.totalXp).toBe(0);
        expect(nextState.seasonRank.sr).toBe(0);
        expect(nextState.activityLogs.length).toBe(0);
        expect(nextState.studyTimer.status).toBe("idle");
        expect(nextState.studyTimer.sessionId).toBeNull();
      });

      it("cancelling an idle timer returns noop", () => {
        const app = createInitialAppState();
        const { nextState, result, summary } = cancelStudyTimerWithReconciliation(app);

        expect(result).toBe("noop");
        expect(summary).toBeUndefined();
        expect(nextState).toBe(app);
      });
    });

    describe("pauseStudyTimerWithReconciliation", () => {
      it("pausing an expired timer settles it without a misleading successful pause result", () => {
        const app = createInitialAppState();
        const startIso = "2026-09-12T10:00:00.000Z";
        const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_expired_pause");
        const runningApp: AppState = { ...app, studyTimer: runningTimer };

        // 30 minutes later, user clicks pause
        const pauseTime = "2026-09-12T10:30:00.000Z";
        const { nextState, result, summary } = pauseStudyTimerWithReconciliation(runningApp, pauseTime);

        expect(result).toBe("completed");
        expect(summary).toBeDefined();
        expect(summary?.sessionId).toBe("sess_expired_pause");
        expect(nextState.studyTimer.status).toBe("idle");
        expect(nextState.progression.totalXp).toBe(25);
      });

      it("pausing a running timer with time remaining pauses normally and returns normal", () => {
        const app = createInitialAppState();
        const startIso = "2026-09-12T10:00:00.000Z";
        const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_normal_pause");
        const runningApp: AppState = { ...app, studyTimer: runningTimer };

        // 10 minutes later, user clicks pause
        const pauseTime = "2026-09-12T10:10:00.000Z";
        const { nextState, result, summary } = pauseStudyTimerWithReconciliation(runningApp, pauseTime);

        expect(result).toBe("normal");
        expect(summary).toBeUndefined();
        expect(nextState.studyTimer.status).toBe("paused");
        expect(nextState.studyTimer.accumulatedElapsedMs).toBe(10 * 60 * 1000);
      });

      it("pausing an already paused or idle timer returns noop", () => {
        const app = createInitialAppState();
        const resIdle = pauseStudyTimerWithReconciliation(app);
        expect(resIdle.result).toBe("noop");

        const pausedApp: AppState = {
          ...app,
          studyTimer: {
            ...app.studyTimer,
            status: "paused",
            sessionId: "sess_already_paused",
            accumulatedElapsedMs: 5000,
          },
        };
        const resPaused = pauseStudyTimerWithReconciliation(pausedApp);
        expect(resPaused.result).toBe("noop");
      });
    });

    describe("resumeStudyTimerWithReconciliation", () => {
      it("resuming an expired paused timer settles it without a misleading successful resume result", () => {
        const app = createInitialAppState();
        const expiredPausedTimer: AppState = {
          ...app,
          studyTimer: {
            ...app.studyTimer,
            status: "paused",
            durationMinutes: 25,
            sessionId: "sess_expired_resume",
            accumulatedElapsedMs: 25 * 60 * 1000, // 25 mins accumulated
          },
        };

        const resumeTime = "2026-09-12T10:30:00.000Z";
        const { nextState, result, summary } = resumeStudyTimerWithReconciliation(expiredPausedTimer, resumeTime);

        expect(result).toBe("completed");
        expect(summary).toBeDefined();
        expect(summary?.sessionId).toBe("sess_expired_resume");
        expect(nextState.studyTimer.status).toBe("idle");
        expect(nextState.progression.totalXp).toBe(25);
      });

      it("resuming a paused timer with time remaining resumes normally and returns normal", () => {
        const app = createInitialAppState();
        const pausedApp: AppState = {
          ...app,
          studyTimer: {
            ...app.studyTimer,
            status: "paused",
            durationMinutes: 25,
            sessionId: "sess_normal_resume",
            accumulatedElapsedMs: 10 * 60 * 1000,
          },
        };

        const resumeTime = "2026-09-12T10:15:00.000Z";
        const { nextState, result, summary } = resumeStudyTimerWithReconciliation(pausedApp, resumeTime);

        expect(result).toBe("normal");
        expect(summary).toBeUndefined();
        expect(nextState.studyTimer.status).toBe("running");
        expect(nextState.studyTimer.segmentStartedAt).toBe(resumeTime);
      });

      it("resuming an already running or idle timer returns noop", () => {
        const app = createInitialAppState();
        const resIdle = resumeStudyTimerWithReconciliation(app);
        expect(resIdle.result).toBe("noop");

        const runningTimer = startStudyTimer(app.studyTimer, 25, "2026-09-12T10:00:00.000Z", "sess_running");
        const runningApp: AppState = { ...app, studyTimer: runningTimer };
        const resRunning = resumeStudyTimerWithReconciliation(runningApp, "2026-09-12T10:05:00.000Z");
        expect(resRunning.result).toBe("noop");
      });
    });

    describe("startStudyTimerWithReconciliation", () => {
      it("starting cannot overwrite an active running timer with time remaining", () => {
        const app = createInitialAppState();
        const startIso = "2026-09-12T10:00:00.000Z";
        const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_original_running");
        const runningApp: AppState = { ...app, studyTimer: runningTimer };

        // Attempting to call start 10 minutes later (active session has 15m remaining)
        const attemptTime = "2026-09-12T10:10:00.000Z";
        const { nextState, result, summary } = startStudyTimerWithReconciliation(runningApp, 50, attemptTime);

        expect(result).toBe("noop");
        expect(summary).toBeUndefined();
        // Original running session must remain completely intact
        expect(nextState.studyTimer.sessionId).toBe("sess_original_running");
        expect(nextState.studyTimer.status).toBe("running");
        expect(nextState.studyTimer.durationMinutes).toBe(25);
        expect(nextState.studyTimer.segmentStartedAt).toBe(startIso);
      });

      it("starting cannot overwrite an active paused timer with time remaining", () => {
        const app = createInitialAppState();
        const pausedApp: AppState = {
          ...app,
          studyTimer: {
            ...app.studyTimer,
            status: "paused",
            durationMinutes: 25,
            sessionId: "sess_original_paused",
            accumulatedElapsedMs: 10 * 60 * 1000,
          },
        };

        const attemptTime = "2026-09-12T10:15:00.000Z";
        const { nextState, result, summary } = startStudyTimerWithReconciliation(pausedApp, 50, attemptTime);

        expect(result).toBe("noop");
        expect(summary).toBeUndefined();
        expect(nextState.studyTimer.sessionId).toBe("sess_original_paused");
        expect(nextState.studyTimer.status).toBe("paused");
        expect(nextState.studyTimer.durationMinutes).toBe(25);
      });

      it("starting when previous session expired settles it with rewards and starts the new timer", () => {
        const app = createInitialAppState();
        const startIso = "2026-09-12T10:00:00.000Z";
        const runningTimer = startStudyTimer(app.studyTimer, 25, startIso, "sess_expired_before_start");
        const runningApp: AppState = { ...app, studyTimer: runningTimer };

        // 35 minutes later, user starts a 50m session
        const newStartTime = "2026-09-12T10:35:00.000Z";
        const { nextState, result, summary } = startStudyTimerWithReconciliation(runningApp, 50, newStartTime);

        expect(result).toBe("normal");
        expect(summary).toBeDefined();
        expect(summary?.sessionId).toBe("sess_expired_before_start");
        expect(summary?.xpEarned).toBe(25);
        expect(summary?.srEarned).toBe(10);
        // Rewards from expired session applied
        expect(nextState.progression.totalXp).toBe(25);
        expect(nextState.seasonRank.sr).toBe(10);
        expect(nextState.activityLogs.length).toBe(1);
        // New timer started
        expect(nextState.studyTimer.status).toBe("running");
        expect(nextState.studyTimer.durationMinutes).toBe(50);
        expect(nextState.studyTimer.segmentStartedAt).toBe(newStartTime);
        expect(nextState.studyTimer.sessionId).not.toBe("sess_expired_before_start");
      });

      it("starting while idle starts the timer normally", () => {
        const app = createInitialAppState();
        const startTime = "2026-09-12T10:00:00.000Z";
        const { nextState, result, summary } = startStudyTimerWithReconciliation(app, 75, startTime);

        expect(result).toBe("normal");
        expect(summary).toBeUndefined();
        expect(nextState.studyTimer.status).toBe("running");
        expect(nextState.studyTimer.durationMinutes).toBe(75);
        expect(nextState.studyTimer.segmentStartedAt).toBe(startTime);
      });
    });
  });
});
