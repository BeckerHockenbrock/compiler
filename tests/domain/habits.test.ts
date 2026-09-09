import { describe, it, expect } from "vitest";
import { createHabit, completeHabit, deleteHabit } from "@/domain/habits";
import { createInitialAppState } from "@/domain/defaults";

describe("Domain: Habit / Ritual Operations", () => {
  it("creates a new habit with 0 initial streak", () => {
    const state = createInitialAppState();
    const { nextState, habit } = createHabit(state, {
      title: "Morning Meditation",
      description: "15 minutes mindfulness",
      xpReward: 30,
      statRewards: { discipline: 5, vitality: 5 },
    });

    expect(habit.title).toBe("Morning Meditation");
    expect(habit.streakCurrent).toBe(0);
    expect(habit.streakBest).toBe(0);
    expect(habit.lastCompletedDate).toBeUndefined();

    expect(nextState.habits.some((h) => h.id === habit.id)).toBe(true);
  });

  it("completes a habit for today, advancing streak and granting XP", () => {
    const state = createInitialAppState();
    const { nextState: stateWithHabit, habit } = createHabit(state, {
      title: "Evening Reading",
      xpReward: 50,
      statRewards: { knowledge: 10 },
    });

    const result = completeHabit(stateWithHabit, habit.id, "2026-09-08");

    expect(result.habitCompleted).toBe(true);
    expect(result.streakCurrent).toBe(1);
    expect(result.streakBest).toBe(1);
    expect(result.xpAwarded).toBe(50);

    // Verify progression updated
    expect(result.nextState.progression.totalXp).toBe(50);
    expect(result.nextState.progression.lifetimeHabitCompletions).toBe(1);
    expect(result.nextState.stats.knowledge?.current).toBe(10);

    // Verify habit updated
    const updatedHabit = result.nextState.habits.find((h) => h.id === habit.id);
    expect(updatedHabit?.lastCompletedDate).toBe("2026-09-08");
    expect(updatedHabit?.streakCurrent).toBe(1);
  });

  it("guarantees same-day idempotency: cannot complete twice on the same calendar day", () => {
    const state = createInitialAppState();
    const { nextState: stateWithHabit, habit } = createHabit(state, {
      title: "Pushups",
      xpReward: 40,
    });

    // Check-in on 2026-09-08
    const firstCheckin = completeHabit(stateWithHabit, habit.id, "2026-09-08");
    expect(firstCheckin.habitCompleted).toBe(true);
    expect(firstCheckin.nextState.progression.totalXp).toBe(40);
    expect(firstCheckin.nextState.progression.lifetimeHabitCompletions).toBe(1);

    // Second check-in on the SAME day 2026-09-08
    const secondCheckin = completeHabit(firstCheckin.nextState, habit.id, "2026-09-08");
    expect(secondCheckin.habitCompleted).toBe(false);
    expect(secondCheckin.xpAwarded).toBe(0);

    // Total XP and counters must remain unchanged
    expect(secondCheckin.nextState.progression.totalXp).toBe(40);
    expect(secondCheckin.nextState.progression.lifetimeHabitCompletions).toBe(1);
  });

  it("extends streak on consecutive calendar day", () => {
    const state = createInitialAppState();
    const { nextState: stateWithHabit, habit } = createHabit(state, {
      title: "Language Drill",
      xpReward: 30,
    });

    // Day 1
    const day1 = completeHabit(stateWithHabit, habit.id, "2026-09-08");
    expect(day1.streakCurrent).toBe(1);

    // Day 2 (consecutive)
    const day2 = completeHabit(day1.nextState, habit.id, "2026-09-09");
    expect(day2.habitCompleted).toBe(true);
    expect(day2.streakCurrent).toBe(2);
    expect(day2.streakBest).toBe(2);
    expect(day2.nextState.progression.totalXp).toBe(60);
  });

  it("deletes a habit cleanly", () => {
    const state = createInitialAppState();
    const { nextState, habit } = createHabit(state, {
      title: "Temporary habit",
      xpReward: 10,
    });

    const deleteRes = deleteHabit(nextState, habit.id);
    expect(deleteRes.habitDeleted).toBe(true);
    expect(deleteRes.nextState.habits.some((h) => h.id === habit.id)).toBe(false);
  });

  describe("Season Rank Integration in Habits", () => {
    it("awards 5 SR to Season Rank upon habit completion and respects 10 SR/day habit cap", () => {
      const state = createInitialAppState();
      const { nextState: withHabit1, habit: h1 } = createHabit(state, {
        title: "Meditation",
        xpReward: 20,
      });
      const { nextState: withBoth, habit: h2 } = createHabit(withHabit1, {
        title: "Reading",
        xpReward: 20,
      });

      // Habit 1 -> 5 SR
      const res1 = completeHabit(withBoth, h1.id, "2026-09-09", "2026-09-09T08:00:00.000Z");
      expect(res1.habitCompleted).toBe(true);
      expect(res1.srAwarded).toBe(5);
      expect(res1.nextState.seasonRank.sr).toBe(5);
      expect(res1.nextState.seasonRank.dailyCaps.habitSrEarned).toBe(5);

      // Habit 2 -> 5 SR (hits 10 SR cap)
      const res2 = completeHabit(res1.nextState, h2.id, "2026-09-09", "2026-09-09T09:00:00.000Z");
      expect(res2.habitCompleted).toBe(true);
      expect(res2.srAwarded).toBe(5);
      expect(res2.nextState.seasonRank.sr).toBe(10);
      expect(res2.nextState.seasonRank.dailyCaps.habitSrEarned).toBe(10);

      // Habit 3 on same day -> 0 SR due to cap
      const { nextState: withThree, habit: h3 } = createHabit(res2.nextState, {
        title: "Journaling",
        xpReward: 20,
      });
      const res3 = completeHabit(withThree, h3.id, "2026-09-09", "2026-09-09T10:00:00.000Z");
      expect(res3.habitCompleted).toBe(true);
      expect(res3.srAwarded).toBe(0);
      expect(res3.nextState.seasonRank.sr).toBe(10);
    });

    it("prevents double-crediting SR on same-day duplicate habit attempt", () => {
      const state = createInitialAppState();
      const { nextState: withHabit, habit } = createHabit(state, {
        title: "Exercise",
        xpReward: 30,
      });

      const first = completeHabit(withHabit, habit.id, "2026-09-09", "2026-09-09T08:00:00.000Z");
      expect(first.srAwarded).toBe(5);

      const duplicate = completeHabit(first.nextState, habit.id, "2026-09-09", "2026-09-09T09:00:00.000Z");
      expect(duplicate.habitCompleted).toBe(false);
      expect(duplicate.srAwarded).toBe(0);
      expect(duplicate.nextState.seasonRank.sr).toBe(5);
    });
  });
});
