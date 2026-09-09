import { describe, it, expect } from "vitest";
import { NamespacedLocalStorageAdapter, InMemoryStorageFallback } from "@/storage/adapter";
import { StorageManager } from "@/storage/storage-manager";
import { createTask, completeTask } from "@/domain/tasks";

describe("Storage: Full Task Progression & Persistence Flow", () => {
  it("persists task creation and completion across page reloads / store reinstantiation", () => {
    // Shared underlying browser storage backing
    const browserStorage = new InMemoryStorageFallback();

    // 1. User loads the app for the first time
    const initialAdapter = new NamespacedLocalStorageAdapter(browserStorage);
    const initialManager = new StorageManager(initialAdapter);
    const load1 = initialManager.loadState();
    expect(load1.ok).toBe(true);
    if (!load1.ok) return;

    let appState = load1.data;
    expect(appState.progression.totalXp).toBe(0);
    expect(appState.progression.level).toBe(1);

    // 2. User adds a task worth 120 XP
    const { nextState: stateWithTask, task } = createTask(appState, {
      title: "Complete MVP Dashboard",
      priority: "high",
      xpReward: 120,
      statRewards: { discipline: 15, knowledge: 10 },
    });
    appState = stateWithTask;
    const save1 = initialManager.saveState(appState);
    expect(save1.ok).toBe(true);

    // 3. User completes the task
    const completion = completeTask(appState, task.id);
    expect(completion.taskCompleted).toBe(true);
    expect(completion.levelUpOccurred).toBe(true);
    expect(completion.newLevel).toBe(2);
    appState = completion.nextState;

    const save2 = initialManager.saveState(appState);
    expect(save2.ok).toBe(true);

    // 4. Simulate Page Refresh:
    // Create a brand new StorageManager and Adapter referencing the same storage
    const refreshedAdapter = new NamespacedLocalStorageAdapter(browserStorage);
    const refreshedManager = new StorageManager(refreshedAdapter);

    const reloadedResult = refreshedManager.loadState();
    expect(reloadedResult.ok).toBe(true);
    if (!reloadedResult.ok) return;

    const reloadedState = reloadedResult.data;

    // Verify progression survived the reload
    expect(reloadedState.progression.totalXp).toBe(120);
    expect(reloadedState.progression.level).toBe(2);
    expect(reloadedState.progression.availableSkillPoints).toBe(1);
    expect(reloadedState.progression.lifetimeCompletedTasks).toBe(1);

    // Verify stat rewards survived the reload
    expect(reloadedState.stats.discipline?.current).toBe(15);
    expect(reloadedState.stats.knowledge?.current).toBe(10);

    // Verify task status survived the reload
    const reloadedTask = reloadedState.tasks.find((t) => t.id === task.id);
    expect(reloadedTask).toBeDefined();
    expect(reloadedTask?.status).toBe("completed");
    expect(reloadedTask?.completedAt).toBeDefined();

    // Verify activity log survived the reload
    expect(reloadedState.activityLogs.length).toBe(1);
    expect(reloadedState.activityLogs[0].title).toBe("Completed: Complete MVP Dashboard");
    expect(reloadedState.activityLogs[0].xpEarned).toBe(120);
  });
});
