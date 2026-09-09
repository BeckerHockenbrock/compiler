import { describe, it, expect } from "vitest";
import { createTask, completeTask } from "@/domain/tasks";
import { createInitialAppState } from "@/domain/defaults";

describe("Domain: Task Operations & Idempotency", () => {
  it("creates a new task with pending status and correct rewards", () => {
    const state = createInitialAppState();
    const { nextState, task } = createTask(state, {
      title: "Write compiler lexer",
      priority: "urgent",
      xpReward: 120,
      statRewards: { discipline: 15, knowledge: 10 },
      notes: "Implement tokenizer in TypeScript",
    });

    expect(task.title).toBe("Write compiler lexer");
    expect(task.status).toBe("pending");
    expect(task.priority).toBe("urgent");
    expect(task.xpReward).toBe(120);
    expect(task.statRewards.discipline).toBe(15);
    expect(task.createdAt).toBeDefined();

    expect(nextState.tasks.length).toBe(state.tasks.length + 1);
    expect(nextState.tasks[0].id).toBe(task.id);
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
});
