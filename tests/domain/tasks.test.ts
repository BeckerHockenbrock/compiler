import { describe, it, expect } from "vitest";
import { createTask, completeTask, updateTask, deleteTask } from "@/domain/tasks";
import { createInitialAppState } from "@/domain/defaults";
import type { AppState } from "@/domain/types";

describe("Domain: Task Operations & Idempotency", () => {
  it("creates a new task with pending status and correct rewards", () => {
    const state = createInitialAppState();
    const { nextState, task } = createTask(state, {
      title: "Write compiler lexer",
      priority: "urgent",
      xpReward: 120,
      statRewards: { discipline: 15, knowledge: 10 },
      notes: "Implement tokenizer in TypeScript",
      dueDate: "2026-09-15",
    });

    expect(task.title).toBe("Write compiler lexer");
    expect(task.status).toBe("pending");
    expect(task.priority).toBe("urgent");
    expect(task.xpReward).toBe(120);
    expect(task.statRewards.discipline).toBe(15);
    expect(task.dueDate).toBe("2026-09-15");
    expect(task.createdAt).toBeDefined();

    expect(nextState.tasks.length).toBe(state.tasks.length + 1);
    expect(nextState.tasks[0].id).toBe(task.id);
  });

  it("updates an existing pending task", () => {
    const state = createInitialAppState();
    const { nextState, task } = createTask(state, {
      title: "Draft architecture",
      priority: "low",
      xpReward: 25,
    });

    const updateResult = updateTask(nextState, task.id, {
      title: "Finalize architecture",
      priority: "high",
      xpReward: 100,
      dueDate: "2026-09-20",
    });

    expect(updateResult.taskUpdated).toBe(true);
    expect(updateResult.updatedTask?.title).toBe("Finalize architecture");
    expect(updateResult.updatedTask?.priority).toBe("high");
    expect(updateResult.updatedTask?.xpReward).toBe(100);
    expect(updateResult.updatedTask?.dueDate).toBe("2026-09-20");

    const found = updateResult.nextState.tasks.find((t) => t.id === task.id);
    expect(found?.title).toBe("Finalize architecture");
  });

  it("refuses to update completed tasks to preserve audit history", () => {
    const state = createInitialAppState();
    const { nextState, task } = createTask(state, {
      title: "Completed mission",
      priority: "medium",
      xpReward: 50,
    });

    const completion = completeTask(nextState, task.id);
    expect(completion.taskCompleted).toBe(true);

    const updateAttempt = updateTask(completion.nextState, task.id, {
      title: "Attempt to modify completed task",
    });

    expect(updateAttempt.taskUpdated).toBe(false);
    const unchanged = updateAttempt.nextState.tasks.find((t) => t.id === task.id);
    expect(unchanged?.title).toBe("Completed mission");
  });

  it("deletes a pending task explicitly", () => {
    const state = createInitialAppState();
    const { nextState, task } = createTask(state, {
      title: "Temporary quest",
      priority: "low",
      xpReward: 25,
    });

    expect(nextState.tasks.some((t) => t.id === task.id)).toBe(true);

    const deleteResult = deleteTask(nextState, task.id);
    expect(deleteResult.taskDeleted).toBe(true);
    expect(deleteResult.nextState.tasks.some((t) => t.id === task.id)).toBe(false);
  });

  it("refuses to delete completed tasks to preserve audit history and totals", () => {
    const state = createInitialAppState();
    const { nextState, task } = createTask(state, {
      title: "Permanent milestone",
      priority: "high",
      xpReward: 100,
    });

    const completion = completeTask(nextState, task.id);
    expect(completion.taskCompleted).toBe(true);

    const deleteAttempt = deleteTask(completion.nextState, task.id);
    expect(deleteAttempt.taskDeleted).toBe(false);
    expect(deleteAttempt.nextState.tasks.some((t) => t.id === task.id)).toBe(true);
  });

  it("completes a pending task and applies progression and stat rewards", () => {
    const initial = createInitialAppState();
    const { nextState: stateWithTask, task } = createTask(initial, {
      title: "Study parsing algorithms",
      priority: "high",
      xpReward: 100,
      statRewards: { knowledge: 20 },
    });

    const completion = completeTask(stateWithTask, task.id);

    expect(completion.taskCompleted).toBe(true);
    expect(completion.xpAwarded).toBe(100);
    expect(completion.levelUpOccurred).toBe(true);
    expect(completion.newLevel).toBe(2);

    // Verify task status
    const completedTask = completion.nextState.tasks.find((t) => t.id === task.id);
    expect(completedTask?.status).toBe("completed");
    expect(completedTask?.completedAt).toBeDefined();

    // Verify progression updates
    expect(completion.nextState.progression.totalXp).toBe(100);
    expect(completion.nextState.progression.level).toBe(2);
    expect(completion.nextState.progression.availableSkillPoints).toBe(1);
    expect(completion.nextState.progression.lifetimeCompletedTasks).toBe(1);

    // Verify stats updated
    expect(completion.nextState.stats.knowledge?.current).toBe(20);

    // Verify activity log appended
    expect(completion.nextState.activityLogs.length).toBe(1);
    expect(completion.nextState.activityLogs[0].xpEarned).toBe(100);
    expect(completion.nextState.activityLogs[0].referenceId).toBe(task.id);
  });

  it("guarantees idempotency: completing an already completed task grants NO duplicate XP or stats", () => {
    const initial = createInitialAppState();
    const { nextState: stateWithTask, task } = createTask(initial, {
      title: "Run unit tests",
      priority: "medium",
      xpReward: 50,
      statRewards: { discipline: 10 },
    });

    // First completion
    const firstCompletion = completeTask(stateWithTask, task.id);
    expect(firstCompletion.taskCompleted).toBe(true);
    expect(firstCompletion.nextState.progression.totalXp).toBe(50);
    expect(firstCompletion.nextState.progression.lifetimeCompletedTasks).toBe(1);
    expect(firstCompletion.nextState.activityLogs.length).toBe(1);

    // Second completion attempt (duplicate)
    const secondCompletion = completeTask(firstCompletion.nextState, task.id);

    // Idempotent no-op
    expect(secondCompletion.taskCompleted).toBe(false);
    expect(secondCompletion.xpAwarded).toBe(0);
    expect(secondCompletion.levelUpOccurred).toBe(false);

    // Progression values must be strictly unchanged
    expect(secondCompletion.nextState.progression.totalXp).toBe(50);
    expect(secondCompletion.nextState.progression.lifetimeCompletedTasks).toBe(1);
    expect(secondCompletion.nextState.stats.discipline?.current).toBe(10);
    expect(secondCompletion.nextState.activityLogs.length).toBe(1);
  });

  it("handles non-existent task IDs safely", () => {
    const state = createInitialAppState();
    const result = completeTask(state, "non_existent_id");

    expect(result.taskCompleted).toBe(false);
    expect(result.xpAwarded).toBe(0);
    expect(result.nextState).toBe(state);
  });

  describe("Season Rank Integration in Tasks", () => {
    it("awards SR to Season Rank upon task completion, respecting daily caps and updating weekly mission", () => {
      const state = createInitialAppState();
      const { nextState: withTask, task } = createTask(state, {
        title: "High priority feature",
        priority: "high",
        xpReward: 50,
      });

      const completion = completeTask(withTask, task.id);
      expect(completion.taskCompleted).toBe(true);
      expect(completion.srAwarded).toBe(10); // high priority awards 10 SR
      expect(completion.nextState.seasonRank.sr).toBe(10);
      expect(completion.nextState.seasonRank.dailyCaps.taskSrEarned).toBe(10);
      expect(completion.nextState.seasonRank.weeklyMission.currentCount).toBe(1);
    });

    it("prevents double-crediting SR on duplicate task completion", () => {
      const state = createInitialAppState();
      const { nextState: withTask, task } = createTask(state, {
        title: "One-off task",
        priority: "urgent",
        xpReward: 100,
      });

      const first = completeTask(withTask, task.id);
      expect(first.srAwarded).toBe(15);
      expect(first.nextState.seasonRank.sr).toBe(15);

      const second = completeTask(first.nextState, task.id);
      expect(second.taskCompleted).toBe(false);
      expect(second.srAwarded).toBe(0);
      expect(second.nextState.seasonRank.sr).toBe(15);
    });

    it("triggers monthly rollover if task completed across month boundary", () => {
      // August state
      const state: AppState = {
        ...createInitialAppState(),
        seasonRank: {
          ...createInitialAppState().seasonRank,
          currentSeasonId: "2026-08",
          currentSeasonLabel: "Season 08 · August 2026",
          tier: "gold",
          division: "II",
          sr: 80,
        },
      };

      const { nextState: withTask, task } = createTask(state, {
        title: "September first task",
        priority: "low",
        xpReward: 25,
      });

      // Complete on 2026-09-01
      const res = completeTask(withTask, task.id, "2026-09-01T08:00:00.000Z");
      expect(res.taskCompleted).toBe(true);

      // Month rolled over: seeded from Gold II -> Silver I, then +3 SR from low task = 3 SR
      expect(res.nextState.seasonRank.currentSeasonId).toBe("2026-09");
      expect(res.nextState.seasonRank.tier).toBe("silver");
      expect(res.nextState.seasonRank.division).toBe("I");
      expect(res.nextState.seasonRank.sr).toBe(3);
    });
  });
});
