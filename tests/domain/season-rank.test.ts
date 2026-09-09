import { describe, it, expect } from "vitest";
import {
  applyActivityToSeasonRank,
  calculateSeededRank,
  checkAndApplySeasonRollover,
  createInitialSeasonRankState,
  evaluatePromotionTrial,
  findLadderIndex,
  formatRankLabel,
  formatSeasonLabel,
  getDaysRemainingInSeason,
  getIsoWeekKey,
  getRankRung,
  getSeasonId,
  isTierPromotionBoundary,
  DAILY_HABIT_SR_CAP,
  DAILY_TASK_SR_CAP,
} from "@/domain/season-rank";
import { createInitialAppState } from "@/domain/defaults";
import type { AppState, SeasonRankState } from "@/domain/types";

describe("Domain: Season Rank", () => {
  describe("Ladder Rungs & Indexing", () => {
    it("indexes 20 rungs from Recruit III (0) to Apex (19)", () => {
      expect(findLadderIndex("recruit", "III")).toBe(0);
      expect(findLadderIndex("recruit", "II")).toBe(1);
      expect(findLadderIndex("recruit", "I")).toBe(2);
      expect(findLadderIndex("bronze", "III")).toBe(3);
      expect(findLadderIndex("silver", "I")).toBe(8);
      expect(findLadderIndex("gold", "II")).toBe(10);
      expect(findLadderIndex("diamond", "III")).toBe(15);
      expect(findLadderIndex("diamond", "I")).toBe(17);
      expect(findLadderIndex("master", null)).toBe(18);
      expect(findLadderIndex("apex", null)).toBe(19);
      expect(formatRankLabel("recruit", "III")).toBe("Recruit III");
      expect(formatRankLabel("master", null)).toBe("Master");
    });

    it("retrieves rungs accurately and clamps out-of-bounds indices", () => {
      expect(getRankRung(0).label).toBe("Recruit III");
      expect(getRankRung(19).label).toBe("Apex");
      expect(getRankRung(-5).label).toBe("Recruit III");
      expect(getRankRung(100).label).toBe("Apex");
    });

    it("correctly identifies tier promotion boundaries", () => {
      // Intra-tier divisions do not cross boundary
      expect(isTierPromotionBoundary("recruit", "III")).toBe(false);
      expect(isTierPromotionBoundary("recruit", "II")).toBe(false);
      expect(isTierPromotionBoundary("gold", "II")).toBe(false);

      // Division I crosses boundary into next tier
      expect(isTierPromotionBoundary("recruit", "I")).toBe(true);
      expect(isTierPromotionBoundary("bronze", "I")).toBe(true);
      expect(isTierPromotionBoundary("silver", "I")).toBe(true);
      expect(isTierPromotionBoundary("gold", "I")).toBe(true);
      expect(isTierPromotionBoundary("platinum", "I")).toBe(true);
      expect(isTierPromotionBoundary("diamond", "I")).toBe(true);

      // Master crosses into Apex
      expect(isTierPromotionBoundary("master", null)).toBe(true);
      // Apex has no higher tier
      expect(isTierPromotionBoundary("apex", null)).toBe(false);
    });
  });

  describe("SR Awards and Daily Caps", () => {
    it("awards SR based on task priority", () => {
      const state = createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC");

      const lowRes = applyActivityToSeasonRank(state, "task_1", "task", "2026-09-09T10:00:00.000Z", "UTC", "low");
      expect(lowRes.srEarned).toBe(3);
      expect(lowRes.nextSeasonRank.sr).toBe(3);

      const medRes = applyActivityToSeasonRank(state, "task_2", "task", "2026-09-09T10:00:00.000Z", "UTC", "medium");
      expect(medRes.srEarned).toBe(6);

      const highRes = applyActivityToSeasonRank(state, "task_3", "task", "2026-09-09T10:00:00.000Z", "UTC", "high");
      expect(highRes.srEarned).toBe(10);

      const urgentRes = applyActivityToSeasonRank(state, "task_4", "task", "2026-09-09T10:00:00.000Z", "UTC", "urgent");
      expect(urgentRes.srEarned).toBe(15);
    });

    it("enforces the 25 SR daily cap on task completions", () => {
      let state = createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC");

      // Task 1: urgent (15 SR) -> 15 SR earned
      const res1 = applyActivityToSeasonRank(state, "task_1", "task", "2026-09-09T10:00:00.000Z", "UTC", "urgent");
      expect(res1.srEarned).toBe(15);
      expect(res1.nextSeasonRank.dailyCaps.taskSrEarned).toBe(15);
      state = res1.nextSeasonRank;

      // Task 2: urgent (15 SR) -> capped: only 10 SR available (15 + 10 = 25 cap)
      const res2 = applyActivityToSeasonRank(state, "task_2", "task", "2026-09-09T11:00:00.000Z", "UTC", "urgent");
      expect(res2.srEarned).toBe(10);
      expect(res2.nextSeasonRank.dailyCaps.taskSrEarned).toBe(25);
      state = res2.nextSeasonRank;

      // Task 3: high (10 SR) -> 0 SR earned because cap of 25 is reached
      const res3 = applyActivityToSeasonRank(state, "task_3", "task", "2026-09-09T12:00:00.000Z", "UTC", "high");
      expect(res3.srEarned).toBe(0);
      expect(res3.nextSeasonRank.dailyCaps.taskSrEarned).toBe(DAILY_TASK_SR_CAP);
    });

    it("enforces the 10 SR daily cap on habit check-ins", () => {
      let state = createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC");

      // Habit 1: 5 SR
      const res1 = applyActivityToSeasonRank(state, "habit_1_d1", "habit", "2026-09-09T10:00:00.000Z", "UTC");
      expect(res1.srEarned).toBe(5);
      expect(res1.nextSeasonRank.dailyCaps.habitSrEarned).toBe(5);
      state = res1.nextSeasonRank;

      // Habit 2: 5 SR
      const res2 = applyActivityToSeasonRank(state, "habit_2_d1", "habit", "2026-09-09T11:00:00.000Z", "UTC");
      expect(res2.srEarned).toBe(5);
      expect(res2.nextSeasonRank.dailyCaps.habitSrEarned).toBe(10);
      state = res2.nextSeasonRank;

      // Habit 3: capped at 10 SR/day -> 0 SR
      const res3 = applyActivityToSeasonRank(state, "habit_3_d1", "habit", "2026-09-09T12:00:00.000Z", "UTC");
      expect(res3.srEarned).toBe(0);
      expect(res3.nextSeasonRank.dailyCaps.habitSrEarned).toBe(DAILY_HABIT_SR_CAP);
    });

    it("resets daily caps when date advances to a new calendar day", () => {
      let state = createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC");

      // Reach cap on Day 1
      const res1 = applyActivityToSeasonRank(state, "task_1", "task", "2026-09-09T10:00:00.000Z", "UTC", "urgent");
      const res2 = applyActivityToSeasonRank(res1.nextSeasonRank, "task_2", "task", "2026-09-09T11:00:00.000Z", "UTC", "urgent");
      expect(res2.nextSeasonRank.dailyCaps.taskSrEarned).toBe(25);
      state = res2.nextSeasonRank;

      // Next day (2026-09-10): caps reset, points can be earned again
      const nextDayRes = applyActivityToSeasonRank(state, "task_3", "task", "2026-09-10T09:00:00.000Z", "UTC", "high");
      expect(nextDayRes.srEarned).toBe(10);
      expect(nextDayRes.nextSeasonRank.dailyCaps.date).toBe("2026-09-10");
      expect(nextDayRes.nextSeasonRank.dailyCaps.taskSrEarned).toBe(10);
    });

    it("prevents double-crediting if the exact same activityId is submitted twice", () => {
      const state = createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC");

      const res1 = applyActivityToSeasonRank(state, "task_unique_1", "task", "2026-09-09T10:00:00.000Z", "UTC", "high");
      expect(res1.srEarned).toBe(10);

      // Re-submitting identical activity ID returns 0 SR without duplicating
      const res2 = applyActivityToSeasonRank(res1.nextSeasonRank, "task_unique_1", "task", "2026-09-09T10:00:00.000Z", "UTC", "high");
      expect(res2.srEarned).toBe(0);
      expect(res2.nextSeasonRank.sr).toBe(10);
    });

    it("safely handles backward clock shifts without corrupting caps or giving negative SR", () => {
      let state = createInitialSeasonRankState("2026-09-10T10:00:00.000Z", "UTC");
      const res1 = applyActivityToSeasonRank(state, "task_1", "task", "2026-09-10T10:00:00.000Z", "UTC", "high");
      state = res1.nextSeasonRank;
      expect(state.dailyCaps.date).toBe("2026-09-10");

      // Backward clock: timestamp is 2026-09-08 (earlier)
      const res2 = applyActivityToSeasonRank(state, "task_backward", "task", "2026-09-08T10:00:00.000Z", "UTC", "high");
      expect(res2.srEarned).toBeGreaterThanOrEqual(0);
      expect(res2.nextSeasonRank.sr).toBeGreaterThanOrEqual(state.sr);
    });
  });

  describe("Weekly Ranked Mission", () => {
    it("progresses weekly mission and awards 25 SR upon completing 5 qualifying activities", () => {
      let state = createInitialSeasonRankState("2026-09-01T10:00:00.000Z", "UTC");
      expect(state.weeklyMission.completed).toBe(false);
      expect(state.weeklyMission.currentCount).toBe(0);

      // Complete 4 activities across multiple days
      for (let i = 1; i <= 4; i++) {
        const res = applyActivityToSeasonRank(
          state,
          `task_step_${i}`,
          "task",
          `2026-09-0${i}T10:00:00.000Z`,
          "UTC",
          "medium"
        );
        state = res.nextSeasonRank;
        expect(state.weeklyMission.currentCount).toBe(i);
        expect(state.weeklyMission.completed).toBe(false);
      }

      // 5th activity completes the weekly mission and grants 25 bonus SR
      const finalRes = applyActivityToSeasonRank(
        state,
        "task_step_5",
        "task",
        "2026-09-05T10:00:00.000Z",
        "UTC",
        "medium" // 6 SR from task
      );

      expect(finalRes.nextSeasonRank.weeklyMission.completed).toBe(true);
      expect(finalRes.nextSeasonRank.weeklyMission.currentCount).toBe(5);
      // 6 SR (task) + 25 SR (weekly mission) = 31 SR
      expect(finalRes.srEarned).toBe(31);
      expect(finalRes.nextSeasonRank.evidence.claimedWeeklyMissionKeys).toContain(
        state.weeklyMission.weekKey
      );
    });

    it("is idempotent: weekly mission awards bonus SR only once per ISO week key", () => {
      let state = createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC");
      for (let i = 1; i <= 5; i++) {
        const res = applyActivityToSeasonRank(state, `task_m_${i}`, "task", "2026-09-09T10:00:00.000Z", "UTC", "low");
        state = res.nextSeasonRank;
      }
      expect(state.weeklyMission.completed).toBe(true);

      const currentSr = state.sr;
      // 6th activity does not award weekly mission bonus again
      const res6 = applyActivityToSeasonRank(state, "task_m_6", "task", "2026-09-09T11:00:00.000Z", "UTC", "low");
      expect(res6.srEarned).toBe(3); // only the task's 3 SR
      expect(res6.nextSeasonRank.sr).toBe(currentSr + 3);
    });
  });

  describe("Division Promotion & Promotion Trial Gating", () => {
    it("advances automatically within a tier (e.g. Recruit III -> Recruit II) when SR hits 100", () => {
      const state: SeasonRankState = {
        ...createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC"),
        isProvisional: false, // cleared provisional status
        provisionalActivitiesCount: 3,
        sr: 95,
      };

      // 10 SR from high task pushes SR to 105 -> promotes to Recruit II with 5 SR overflow
      const res = applyActivityToSeasonRank(
        state,
        "task_promo_1",
        "task",
        "2026-09-09T10:00:00.000Z",
        "UTC",
        "high"
      );

      expect(res.promoted).toBe(true);
      expect(res.newTier).toBe("recruit");
      expect(res.newDivision).toBe("II");
      expect(res.nextSeasonRank.sr).toBe(5);
    });

    it("blocks tier promotion boundary (Recruit I -> Bronze III) if promotion trial criteria are not met", () => {
      const state: SeasonRankState = {
        ...createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC"),
        tier: "recruit",
        division: "I",
        sr: 95,
        isProvisional: false,
        provisionalActivitiesCount: 3,
        // No qualifying sessions or active days in evidence
      };

      const res = applyActivityToSeasonRank(
        state,
        "task_boundary_1",
        "task",
        "2026-09-09T10:00:00.000Z",
        "UTC",
        "high"
      );

      // Promotion is blocked; SR capped at 100
      expect(res.promoted).toBe(false);
      expect(res.newTier).toBe("recruit");
      expect(res.newDivision).toBe("I");
      expect(res.nextSeasonRank.sr).toBe(100);
      expect(res.trialStatus.allMet).toBe(false);
    });

    it("promotes across tier boundary when all promotion trial requirements are fulfilled", () => {
      // Setup state meeting: 3 sessions in last 7 days, 4 active days, weekly mission completed
      const today = "2026-09-09";
      const state: SeasonRankState = {
        ...createInitialSeasonRankState(`${today}T10:00:00.000Z`, "UTC"),
        tier: "recruit",
        division: "I",
        sr: 95,
        isProvisional: false,
        provisionalActivitiesCount: 3,
        weeklyMission: {
          id: "mission_test",
          weekKey: getIsoWeekKey(today),
          title: "Weekly Focus",
          description: "Test",
          targetCount: 5,
          currentCount: 5,
          completed: true,
          srReward: 25,
        },
        evidence: {
          creditedActivityIds: ["s1", "s2"],
          qualifyingSessionTimestamps: [
            "2026-09-08T10:00:00.000Z",
            "2026-09-07T10:00:00.000Z",
          ],
          activeCalendarDates: ["2026-09-06", "2026-09-07", "2026-09-08"],
          claimedWeeklyMissionKeys: [getIsoWeekKey(today)],
        },
      };

      // Completing a high task today adds the 3rd qualifying session and 4th active day (today)
      const res = applyActivityToSeasonRank(
        state,
        "task_promo_success",
        "task",
        `${today}T10:00:00.000Z`,
        "UTC",
        "high"
      );

      expect(res.promoted).toBe(true);
      expect(res.newTier).toBe("bronze");
      expect(res.newDivision).toBe("III");
      expect(res.nextSeasonRank.sr).toBe(0); // Resets to 0 upon crossing tier
    });

    it("requires 5 active days for Master and Apex promotion trials instead of 4", () => {
      const trialStatus = evaluatePromotionTrial(
        {
          ...createInitialSeasonRankState("2026-09-09T10:00:00.000Z", "UTC"),
          tier: "diamond",
          division: "I",
          sr: 100,
          isProvisional: false,
          provisionalActivitiesCount: 3,
          weeklyMission: {
            id: "m",
            weekKey: "2026-W37",
            title: "T",
            description: "D",
            targetCount: 5,
            currentCount: 5,
            completed: true,
            srReward: 25,
          },
          evidence: {
            creditedActivityIds: [],
            qualifyingSessionTimestamps: [
              "2026-09-09T10:00:00.000Z",
              "2026-09-08T10:00:00.000Z",
              "2026-09-07T10:00:00.000Z",
            ],
            activeCalendarDates: ["2026-09-09", "2026-09-08", "2026-09-07", "2026-09-06"], // 4 active days
            claimedWeeklyMissionKeys: ["2026-W37"],
          },
        },
        "master", // target tier
        "2026-09-09",
        "UTC"
      );

      // Target is 5 for Master, so 4 active days is not enough
      expect(trialStatus.activeDaysTarget).toBe(5);
      expect(trialStatus.activeDaysCount).toBe(4);
      expect(trialStatus.allMet).toBe(false);
    });

    it("strictly blocks promotion while provisional even if SR is 100 and trial criteria are met", () => {
      const today = "2026-09-09";
      const provisionalState: SeasonRankState = {
        ...createInitialSeasonRankState(`${today}T10:00:00.000Z`, "UTC"),
        tier: "recruit",
        division: "I",
        sr: 100,
        isProvisional: true,
        provisionalActivitiesCount: 1, // only 1 of 3 completed
        weeklyMission: {
          id: "m",
          weekKey: getIsoWeekKey(today),
          title: "M",
          description: "D",
          targetCount: 5,
          currentCount: 5,
          completed: true,
          srReward: 25,
        },
        evidence: {
          creditedActivityIds: [],
          qualifyingSessionTimestamps: [
            "2026-09-09T10:00:00.000Z",
            "2026-09-08T10:00:00.000Z",
            "2026-09-07T10:00:00.000Z",
          ],
          activeCalendarDates: ["2026-09-09", "2026-09-08", "2026-09-07", "2026-09-06"],
          claimedWeeklyMissionKeys: [getIsoWeekKey(today)],
        },
      };

      const trial = evaluatePromotionTrial(provisionalState, "bronze", today, "UTC");
      expect(trial.isProvisional).toBe(true);
      expect(trial.allMet).toBe(false);
    });
  });

  describe("Monthly Soft Resets & Seeding Rules", () => {
    it("implements consistent 2-rung ladder descent across all tiers", () => {
      // Gold II (10) -> Silver I (8)
      const goldSeed = calculateSeededRank("gold", "II");
      expect(goldSeed.tier).toBe("silver");
      expect(goldSeed.division).toBe("I");

      // Diamond I (17) -> Diamond III (15)
      const diamondSeed = calculateSeededRank("diamond", "I");
      expect(diamondSeed.tier).toBe("diamond");
      expect(diamondSeed.division).toBe("III");

      // Master (18) -> Diamond II (16) (consistent index - 2)
      const masterSeed = calculateSeededRank("master", null);
      expect(masterSeed.tier).toBe("diamond");
      expect(masterSeed.division).toBe("II");

      // Apex (19) -> Diamond I (17) (consistent index - 2)
      const apexSeed = calculateSeededRank("apex", null);
      expect(apexSeed.tier).toBe("diamond");
      expect(apexSeed.division).toBe("I");
    });

    it("clamps ranks at or below Bronze III cleanly to Recruit III", () => {
      const r3 = calculateSeededRank("recruit", "III");
      expect(r3.tier).toBe("recruit");
      expect(r3.division).toBe("III");

      const r2 = calculateSeededRank("recruit", "II");
      expect(r2.tier).toBe("recruit");
      expect(r2.division).toBe("III");

      const r1 = calculateSeededRank("recruit", "I");
      expect(r1.tier).toBe("recruit");
      expect(r1.division).toBe("III");

      const b3 = calculateSeededRank("bronze", "III");
      expect(b3.tier).toBe("recruit");
      expect(b3.division).toBe("III");
    });
  });

  describe("Monthly Rollover & Skipped Months Protection", () => {
    it("archives the completed active season and seeds user 2 divisions below", () => {
      const appState: AppState = {
        ...createInitialAppState(),
        seasonRank: {
          ...createInitialSeasonRankState("2026-08-15T12:00:00.000Z", "UTC"),
          currentSeasonId: "2026-08",
          currentSeasonLabel: "Season 08 · August 2026",
          tier: "gold",
          division: "II",
          sr: 75,
          seasonalPeakTier: "gold",
          seasonalPeakDivision: "I",
          history: [],
        },
      };

      // Rollover to September
      const result = checkAndApplySeasonRollover(appState, "2026-09-01T00:00:00.000Z", "UTC");
      expect(result.rolledOver).toBe(true);

      const nextSr = result.nextState.seasonRank;
      expect(nextSr.currentSeasonId).toBe("2026-09");
      expect(nextSr.currentSeasonLabel).toBe("Season 09 · September 2026");
      expect(nextSr.tier).toBe("silver");
      expect(nextSr.division).toBe("I"); // Gold II -> Silver I
      expect(nextSr.sr).toBe(0);
      expect(nextSr.isProvisional).toBe(true);

      // Exactly 1 history record created for Season 08
      expect(nextSr.history).toHaveLength(1);
      expect(nextSr.history[0].seasonId).toBe("2026-08");
      expect(nextSr.history[0].finalTier).toBe("gold");
      expect(nextSr.history[0].finalDivision).toBe("II");
      expect(nextSr.history[0].finalSr).toBe(75);
      expect(nextSr.history[0].peakDivision).toBe("I");
    });

    it("is completely idempotent when called multiple times in the same month (no duplicate snapshots)", () => {
      const appState = createInitialAppState();
      const first = checkAndApplySeasonRollover(appState, "2026-09-05T12:00:00.000Z", "UTC");
      expect(first.rolledOver).toBe(false); // same month, no rollover

      // Call repeatedly
      const second = checkAndApplySeasonRollover(first.nextState, "2026-09-05T13:00:00.000Z", "UTC");
      expect(second.rolledOver).toBe(false);
      expect(second.nextState.seasonRank.history).toHaveLength(0);
    });

    it("preserves at most one history record when a user skips multiple months (no dummy duplicate history)", () => {
      const appState: AppState = {
        ...createInitialAppState(),
        seasonRank: {
          ...createInitialSeasonRankState("2026-05-10T12:00:00.000Z", "UTC"),
          currentSeasonId: "2026-05",
          currentSeasonLabel: "Season 05 · May 2026",
          tier: "diamond",
          division: "I",
          sr: 40,
          history: [],
        },
      };

      // User skips June, July, August, and opens the app in September
      const result = checkAndApplySeasonRollover(appState, "2026-09-09T08:00:00.000Z", "UTC");
      expect(result.rolledOver).toBe(true);

      const nextSr = result.nextState.seasonRank;
      expect(nextSr.currentSeasonId).toBe("2026-09");
      // Diamond I -> Diamond III
      expect(nextSr.tier).toBe("diamond");
      expect(nextSr.division).toBe("III");
      // Exactly 1 history record for Season 05 is saved; NO dummy records for June/July/August
      expect(nextSr.history).toHaveLength(1);
      expect(nextSr.history[0].seasonId).toBe("2026-05");
    });

    it("never rolls over when device clock is changed backwards in time", () => {
      const appState: AppState = {
        ...createInitialAppState(),
        seasonRank: {
          ...createInitialSeasonRankState("2026-09-09T12:00:00.000Z", "UTC"),
          currentSeasonId: "2026-09",
          currentSeasonLabel: "Season 09 · September 2026",
          tier: "gold",
          division: "I",
          sr: 50,
          history: [],
        },
      };

      // Device clock set backwards to August 2026
      const result = checkAndApplySeasonRollover(appState, "2026-08-15T12:00:00.000Z", "UTC");
      expect(result.rolledOver).toBe(false);
      expect(result.nextState.seasonRank.currentSeasonId).toBe("2026-09");
      expect(result.nextState.seasonRank.tier).toBe("gold");
      expect(result.nextState.seasonRank.division).toBe("I");
      expect(result.nextState.seasonRank.history).toHaveLength(0);
    });
  });

  describe("Authoritative Timezone & Month Boundaries", () => {
    it("formats season label cleanly", () => {
      expect(formatSeasonLabel("2026-09")).toBe("Season 09 · September 2026");
      expect(formatSeasonLabel("2027-01")).toBe("Season 01 · January 2027");
    });

    it("calculates correct seasonId across different IANA timezones at month boundaries", () => {
      // 2026-08-31 23:30:00 UTC:
      // - In UTC: August (2026-08)
      // - In Asia/Tokyo (UTC+9): September 1 08:30 (2026-09)
      // - In America/New_York (UTC-4): August 31 19:30 (2026-08)
      const boundaryTimestamp = "2026-08-31T23:30:00.000Z";

      expect(getSeasonId(boundaryTimestamp, "UTC")).toBe("2026-08");
      expect(getSeasonId(boundaryTimestamp, "America/New_York")).toBe("2026-08");
      expect(getSeasonId(boundaryTimestamp, "Asia/Tokyo")).toBe("2026-09");
    });

    it("calculates remaining days in season accurately", () => {
      // September has 30 days
      const daysLeft = getDaysRemainingInSeason("2026-09-09T12:00:00.000Z", "UTC");
      expect(daysLeft).toBe(21); // 30 - 9 = 21 days
    });
  });
});
