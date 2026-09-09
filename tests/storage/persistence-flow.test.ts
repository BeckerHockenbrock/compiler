import { describe, it, expect } from "vitest";
import { NamespacedLocalStorageAdapter, InMemoryStorageFallback } from "@/storage/adapter";
import { StorageManager } from "@/storage/storage-manager";
import { createTask, completeTask } from "@/domain/tasks";
import { createHabit, completeHabit } from "@/domain/habits";
import { allocateSkillPoint } from "@/domain/skills";
import { exportBackup, importBackup } from "@/storage/backup";

describe("Storage: Full Progression & Persistence Flow", () => {
  it("persists tasks, habits, and skill allocation across store reinstantiation", () => {
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
    expect(initialManager.saveState(appState).ok).toBe(true);

    // 3. User completes the task (levels up from 1 to 2, earns 1 skill point)
    const taskCompletion = completeTask(appState, task.id);
    expect(taskCompletion.taskCompleted).toBe(true);
    expect(taskCompletion.levelUpOccurred).toBe(true);
    expect(taskCompletion.newLevel).toBe(2);
    appState = taskCompletion.nextState;
    expect(initialManager.saveState(appState).ok).toBe(true);

    // 4. User adds and completes a daily habit
    const { nextState: stateWithHabit, habit } = createHabit(appState, {
      title: "Morning Routine",
      xpReward: 50,
      statRewards: { vitality: 5 },
    });
    appState = stateWithHabit;

    const habitCompletion = completeHabit(appState, habit.id, "2026-09-08");
    expect(habitCompletion.habitCompleted).toBe(true);
    expect(habitCompletion.streakCurrent).toBe(1);
    appState = habitCompletion.nextState;
    expect(initialManager.saveState(appState).ok).toBe(true);

    // 5. User allocates their 1 earned skill point to "deep_work"
    const skillAllocation = allocateSkillPoint(appState, "deep_work");
    expect(skillAllocation.skillUpgraded).toBe(true);
    appState = skillAllocation.nextState;
    expect(initialManager.saveState(appState).ok).toBe(true);

    // 6. Simulate Page Refresh:
    // Create a brand new StorageManager and Adapter referencing the same storage
    const refreshedAdapter = new NamespacedLocalStorageAdapter(browserStorage);
    const refreshedManager = new StorageManager(refreshedAdapter);

    const reloadedResult = refreshedManager.loadState();
    expect(reloadedResult.ok).toBe(true);
    if (!reloadedResult.ok) return;

    const reloadedState = reloadedResult.data;

    // Verify progression survived reload
    expect(reloadedState.progression.totalXp).toBe(170); // 120 + 50
    expect(reloadedState.progression.level).toBe(2);
    expect(reloadedState.progression.availableSkillPoints).toBe(0); // 1 earned - 1 spent
    expect(reloadedState.progression.lifetimeCompletedTasks).toBe(1);
    expect(reloadedState.progression.lifetimeHabitCompletions).toBe(1);

    // Verify stats survived reload (discipline: 15 task + 5 skill buff = 20; knowledge: 10 task + 5 skill buff = 15; vitality: 5 habit = 5)
    expect(reloadedState.stats.discipline?.current).toBe(20);
    expect(reloadedState.stats.knowledge?.current).toBe(15);
    expect(reloadedState.stats.vitality?.current).toBe(5);

    // Verify habit streak survived reload
    const reloadedHabit = reloadedState.habits.find((h) => h.id === habit.id);
    expect(reloadedHabit?.streakCurrent).toBe(1);
    expect(reloadedHabit?.lastCompletedDate).toBe("2026-09-08");

    // Verify skill level survived reload
    const reloadedSkill = reloadedState.skills.find((s) => s.id === "deep_work");
    expect(reloadedSkill?.level).toBe(2);

    // 7. Verify Backup Export & Import cycle
    const backupJson = exportBackup(reloadedState);
    const emptyStorage = new InMemoryStorageFallback();
    const importAdapter = new NamespacedLocalStorageAdapter(emptyStorage);

    const importRes = importBackup(importAdapter, backupJson, { confirmOverwrite: true });
    expect(importRes.ok).toBe(true);
    if (!importRes.ok) return;

    expect(importRes.data.progression.totalXp).toBe(170);
    expect(importRes.data.skills.find((s) => s.id === "deep_work")?.level).toBe(2);
  });
});
