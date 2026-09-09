import { describe, it, expect } from "vitest";
import { calculateLevel, applyActivityReward } from "@/domain/progression";
import { createInitialAppState } from "@/domain/defaults";
import type { ActivityReward } from "@/domain/types";

describe("Domain: Progression & Leveling", () => {
  describe("calculateLevel", () => {
    it("returns level 1 for 0 XP", () => {
      const result = calculateLevel(0);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(0);
      expect(result.nextLevelXp).toBe(100);
      expect(result.progressRatio).toBe(0);
    });

    it("returns level 1 with 50% progress for 50 XP", () => {
      const result = calculateLevel(50);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(50);
      expect(result.requiredLevelXp).toBe(100);
      expect(result.progressRatio).toBe(0.5);
    });

    it("advances to level 2 at exactly 100 XP", () => {
      const result = calculateLevel(100);
      expect(result.level).toBe(2);
      expect(result.currentLevelXp).toBe(0);
      expect(result.nextLevelXp).toBe(400); // 100 * 2^2
      expect(result.requiredLevelXp).toBe(300); // 400 - 100
      expect(result.progressRatio).toBe(0);
    });

    it("advances to level 3 at 400 XP", () => {
      const result = calculateLevel(400);
      expect(result.level).toBe(3);
      expect(result.currentLevelXp).toBe(0);
      expect(result.nextLevelXp).toBe(900);
    });

    it("handles negative XP safely by clamping to 0", () => {
      const result = calculateLevel(-100);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(0);
    });
  });

  describe("applyActivityReward", () => {
    it("updates XP, stats, and adds activity log without mutating input state", () => {
      const initial = createInitialAppState();
      const reward: ActivityReward = {
        xp: 150,
        statRewards: { discipline: 15, knowledge: 10 },
        title: "Studied compiler theory",
        type: "task",
        referenceId: "task_1",
      };

      const { nextState, levelUpOccurred, newLevel } = applyActivityReward(
        initial,
        reward
      );

      // Input state is not mutated
      expect(initial.progression.totalXp).toBe(0);
      expect(initial.activityLogs.length).toBe(0);

      // Next state reflects reward
      expect(nextState.progression.totalXp).toBe(150);
      expect(levelUpOccurred).toBe(true);
      expect(newLevel).toBe(2);
      expect(nextState.progression.availableSkillPoints).toBe(1);
      expect(nextState.progression.lifetimeCompletedTasks).toBe(1);

      // Stats are updated
      expect(nextState.stats.discipline?.current).toBe(15);
      expect(nextState.stats.discipline?.lifetimeEarned).toBe(15);
      expect(nextState.stats.knowledge?.current).toBe(10);

      // Activity log is prepended
      expect(nextState.activityLogs.length).toBe(1);
      expect(nextState.activityLogs[0].title).toBe("Studied compiler theory");
      expect(nextState.activityLogs[0].xpEarned).toBe(150);
      expect(nextState.activityLogs[0].type).toBe("task");
    });
  });
});
