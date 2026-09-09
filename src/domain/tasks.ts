/**
 * Pure Domain Logic for Task Operations
 *
 * All functions are pure, immutable, and strictly decoupled from
 * React, DOM APIs, and persistence mechanisms.
 */

import type { AppState, Task, TaskPriority } from "./types";
import { nowUtc } from "./date-time";
import { applyActivityReward } from "./progression";

export interface CreateTaskInput {
  readonly title: string;
  readonly priority: TaskPriority;
  readonly xpReward: number;
  readonly statRewards?: Readonly<Record<string, number>>;
  readonly notes?: string;
  readonly dueDate?: string;
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly priority?: TaskPriority;
  readonly xpReward?: number;
  readonly statRewards?: Readonly<Record<string, number>>;
  readonly notes?: string;
  readonly dueDate?: string;
}

export interface CompleteTaskResult {
  readonly nextState: AppState;
  readonly taskCompleted: boolean;
  readonly levelUpOccurred: boolean;
  readonly newLevel: number;
  readonly xpAwarded: number;
}

/**
 * Creates a new task and immutably prepends it to the tasks list.
 */
export function createTask(
  currentState: AppState,
  input: CreateTaskInput
): { nextState: AppState; task: Task } {
  const timestamp = nowUtc();
  const safeTitle = input.title.trim();
  const safeXp = Math.max(0, Math.floor(input.xpReward));

  const newTask: Task = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: safeTitle || "Untitled Task",
    notes: input.notes?.trim() || undefined,
    status: "pending",
    priority: input.priority,
    dueDate: input.dueDate,
    xpReward: safeXp,
    statRewards: input.statRewards ? { ...input.statRewards } : {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    nextState: {
      ...currentState,
      tasks: [newTask, ...currentState.tasks],
    },
    task: newTask,
  };
}

/**
 * Updates an existing pending task.
 * Completed tasks cannot be edited to preserve progression history and integrity.
 */
export function updateTask(
  currentState: AppState,
  taskId: string,
  updates: UpdateTaskInput
): { nextState: AppState; taskUpdated: boolean; updatedTask?: Task } {
  const targetTask = currentState.tasks.find((t) => t.id === taskId);

  if (!targetTask || targetTask.status === "completed") {
    return { nextState: currentState, taskUpdated: false };
  }

  const timestamp = nowUtc();
  const updatedTask: Task = {
    ...targetTask,
    title: updates.title !== undefined ? updates.title.trim() || targetTask.title : targetTask.title,
    notes: updates.notes !== undefined ? updates.notes.trim() || undefined : targetTask.notes,
    priority: updates.priority ?? targetTask.priority,
    dueDate: updates.dueDate !== undefined ? updates.dueDate || undefined : targetTask.dueDate,
    xpReward: updates.xpReward !== undefined ? Math.max(0, Math.floor(updates.xpReward)) : targetTask.xpReward,
    statRewards: updates.statRewards ? { ...updates.statRewards } : targetTask.statRewards,
    updatedAt: timestamp,
  };

  const nextTasks = currentState.tasks.map((t) => (t.id === taskId ? updatedTask : t));

  return {
    nextState: {
      ...currentState,
      tasks: nextTasks,
    },
    taskUpdated: true,
    updatedTask,
  };
}

/**
 * Explicitly deletes an existing pending task.
 * Completed tasks cannot be deleted to preserve progression history and audit integrity.
 */
export function deleteTask(
  currentState: AppState,
  taskId: string
): { nextState: AppState; taskDeleted: boolean } {
  const targetTask = currentState.tasks.find((t) => t.id === taskId);

  if (!targetTask || targetTask.status === "completed") {
    return { nextState: currentState, taskDeleted: false };
  }

  return {
    nextState: {
      ...currentState,
      tasks: currentState.tasks.filter((t) => t.id !== taskId),
    },
    taskDeleted: true,
  };
}

/**
 * Completes a task idempotently.
 *
 * IDEMPOTENCY GUARANTEE:
 * If the task is already completed (or doesn't exist), this function
 * returns the state untouched with taskCompleted = false and xpAwarded = 0.
 * Under NO circumstances will XP or stat rewards be granted more than once.
 */
export function completeTask(
  currentState: AppState,
  taskId: string
): CompleteTaskResult {
  const targetTask = currentState.tasks.find((t) => t.id === taskId);

  // If task not found or already completed, return currentState unchanged
  if (!targetTask || targetTask.status === "completed") {
    return {
      nextState: currentState,
      taskCompleted: false,
      levelUpOccurred: false,
      newLevel: currentState.progression.level,
      xpAwarded: 0,
    };
  }

  const timestamp = nowUtc();

  // 1. Mark task as completed
  const updatedTasks = currentState.tasks.map((task) => {
    if (task.id === taskId) {
      return {
        ...task,
        status: "completed" as const,
        completedAt: timestamp,
        updatedAt: timestamp,
      };
    }
    return task;
  });

  const stateWithCompletedTask: AppState = {
    ...currentState,
    tasks: updatedTasks,
  };

  // 2. Award XP, stats, and log entry via progression engine
  const rewardResult = applyActivityReward(stateWithCompletedTask, {
    xp: targetTask.xpReward,
    statRewards: targetTask.statRewards,
    title: `Completed: ${targetTask.title}`,
    type: "task",
    referenceId: targetTask.id,
  });

  return {
    nextState: rewardResult.nextState,
    taskCompleted: true,
    levelUpOccurred: rewardResult.levelUpOccurred,
    newLevel: rewardResult.newLevel,
    xpAwarded: targetTask.xpReward,
  };
}
