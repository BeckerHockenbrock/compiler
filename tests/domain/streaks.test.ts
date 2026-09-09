import { describe, it, expect } from "vitest";
import { evaluateHabitCompletion, isStreakActive } from "@/domain/streaks";
import type { Habit } from "@/domain/types";

describe("Domain: Streak Calculations", () => {
  const baseHabit: Habit = {
    id: "habit_1",
    title: "Read research paper",
    frequency: "daily",
    streakCurrent: 3,
    streakBest: 5,
    lastCompletedDate: "2026-09-05",
    xpReward: 30,
    statRewards: { knowledge: 5 },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
  };

  it("handles first-time habit completion", () => {
    const freshHabit: Habit = {
      ...baseHabit,
      streakCurrent: 0,
      streakBest: 0,
      lastCompletedDate: undefined,
    };

    const result = evaluateHabitCompletion(freshHabit, "2026-09-08");
    expect(result.streakCurrent).toBe(1);
    expect(result.streakBest).toBe(1);
    expect(result.lastCompletedDate).toBe("2026-09-08");
    expect(result.isNewDayCompletion).toBe(true);
  });

  it("increments streak when completed on the next consecutive calendar day", () => {
    const result = evaluateHabitCompletion(baseHabit, "2026-09-06");
    expect(result.streakCurrent).toBe(4);
    expect(result.streakBest).toBe(5);
    expect(result.lastCompletedDate).toBe("2026-09-06");
    expect(result.isNewDayCompletion).toBe(true);
  });

  it("updates best streak when current streak exceeds previous record", () => {
    const nearRecordHabit: Habit = {
      ...baseHabit,
      streakCurrent: 5,
      streakBest: 5,
      lastCompletedDate: "2026-09-05",
    };

    const result = evaluateHabitCompletion(nearRecordHabit, "2026-09-06");
    expect(result.streakCurrent).toBe(6);
    expect(result.streakBest).toBe(6);
  });

  it("maintains current streak without double-incrementing on the same calendar day", () => {
    const result = evaluateHabitCompletion(baseHabit, "2026-09-05");
    expect(result.streakCurrent).toBe(3);
    expect(result.streakBest).toBe(5);
    expect(result.isNewDayCompletion).toBe(false);
  });

  it("resets streak to 1 when a calendar day is missed", () => {
    // Gap: 2026-09-05 to 2026-09-07 (diff = 2)
    const result = evaluateHabitCompletion(baseHabit, "2026-09-07");
    expect(result.streakCurrent).toBe(1);
    expect(result.streakBest).toBe(5); // Best streak preserved
    expect(result.isNewDayCompletion).toBe(true);
  });

  describe("isStreakActive", () => {
    it("reports active if completed today or yesterday", () => {
      expect(isStreakActive("2026-09-08", "2026-09-08")).toBe(true);
      expect(isStreakActive("2026-09-07", "2026-09-08")).toBe(true);
    });

    it("reports inactive if missed more than 1 day or never completed", () => {
      expect(isStreakActive("2026-09-06", "2026-09-08")).toBe(false);
      expect(isStreakActive(undefined, "2026-09-08")).toBe(false);
    });
  });
});
