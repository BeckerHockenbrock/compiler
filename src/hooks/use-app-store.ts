"use client";

/**
 * React Application Store & Storage Bridge
 *
 * Provides reactive access to AppState, ensures hydration safety on static export,
 * and automatically persists all domain state changes via StorageManager.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { AppState } from "@/domain/types";
import { calculateLevel, type LevelProgress } from "@/domain/progression";
import {
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  type CreateTaskInput,
  type UpdateTaskInput,
  type CompleteTaskResult,
} from "@/domain/tasks";
import {
  createHabit,
  completeHabit,
  deleteHabit,
  type CreateHabitInput,
  type CompleteHabitResult,
} from "@/domain/habits";
import { allocateSkillPoint, type AllocateSkillPointResult } from "@/domain/skills";
import { exportBackup, importBackup } from "@/storage/backup";
import { StorageManager } from "@/storage/storage-manager";
import { NamespacedLocalStorageAdapter } from "@/storage/adapter";
import type { StorageError, EstimatedStorageMetrics } from "@/storage/types";
import type { Result } from "@/lib/result";

// Singleton storage manager & adapter instance for the browser session
let storageAdapterInstance: NamespacedLocalStorageAdapter | null = null;
let storageManagerInstance: StorageManager | null = null;

function getStorageInstances() {
  if (!storageAdapterInstance) {
    storageAdapterInstance = new NamespacedLocalStorageAdapter();
    storageManagerInstance = new StorageManager(storageAdapterInstance);
  }
  return {
    adapter: storageAdapterInstance,
    manager: storageManagerInstance as StorageManager,
  };
}

export interface UseAppStoreReturn {
  readonly state: AppState | null;
  readonly isHydrated: boolean;
  readonly error: StorageError | null;
  readonly metrics: EstimatedStorageMetrics | null;
  readonly levelProgress: LevelProgress | null;

  // Task Actions
  readonly addTask: (input: CreateTaskInput) => boolean;
  readonly editTask: (taskId: string, updates: UpdateTaskInput) => boolean;
  readonly removeTask: (taskId: string) => boolean;
  readonly finishTask: (taskId: string) => CompleteTaskResult | null;

  // Habit Actions
  readonly addHabit: (input: CreateHabitInput) => boolean;
  readonly finishHabit: (habitId: string, customDate?: string) => CompleteHabitResult | null;
  readonly removeHabit: (habitId: string) => boolean;

  // Skill Actions
  readonly assignSkillPoint: (skillId: string) => AllocateSkillPointResult | null;

  // Data / Vault Actions
  readonly exportData: () => string | null;
  readonly importData: (jsonString: string, confirmOverwrite: boolean) => Result<AppState, StorageError>;
  readonly resetDefaults: () => boolean;
  readonly refreshMetrics: () => void;
}

export function useAppStore(): UseAppStoreReturn {
  const [state, setState] = useState<AppState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<StorageError | null>(null);
  const [metrics, setMetrics] = useState<EstimatedStorageMetrics | null>(null);

  const refreshMetrics = useCallback(() => {
    const { adapter } = getStorageInstances();
    const metricsRes = adapter.getEstimatedMetrics();
    if (metricsRes.ok) {
      setMetrics(metricsRes.data);
    }
  }, []);

  // Load state upon client mount to avoid SSR hydration mismatches
  useEffect(() => {
    const { manager } = getStorageInstances();
    const result = manager.loadState();

    if (result.ok) {
      setState(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    refreshMetrics();
    setIsHydrated(true);
  }, [refreshMetrics]);

  // Compute current leveling progress derived from state
  const levelProgress = useMemo(() => {
    if (!state) return null;
    return calculateLevel(state.progression.totalXp);
  }, [state]);

  // -------------------------------------------------------------
  // Task Actions
  // -------------------------------------------------------------

  const addTask = useCallback(
    (input: CreateTaskInput): boolean => {
      if (!state) return false;

      const { nextState } = createTask(state, input);
      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(nextState);

      if (saveRes.ok) {
        setState(nextState);
        refreshMetrics();
        return true;
      } else {
        setError(saveRes.error);
        return false;
      }
    },
    [state, refreshMetrics]
  );

  const editTask = useCallback(
    (taskId: string, updates: UpdateTaskInput): boolean => {
      if (!state) return false;

      const { nextState, taskUpdated } = updateTask(state, taskId, updates);
      if (!taskUpdated) return false;

      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(nextState);

      if (saveRes.ok) {
        setState(nextState);
        refreshMetrics();
        return true;
      } else {
        setError(saveRes.error);
        return false;
      }
    },
    [state, refreshMetrics]
  );

  const removeTask = useCallback(
    (taskId: string): boolean => {
      if (!state) return false;

      const { nextState, taskDeleted } = deleteTask(state, taskId);
      if (!taskDeleted) return false;

      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(nextState);

      if (saveRes.ok) {
        setState(nextState);
        refreshMetrics();
        return true;
      } else {
        setError(saveRes.error);
        return false;
      }
    },
    [state, refreshMetrics]
  );

  const finishTask = useCallback(
    (taskId: string): CompleteTaskResult | null => {
      if (!state) return null;

      const result = completeTask(state, taskId);
      if (!result.taskCompleted) {
        // Idempotent no-op
        return result;
      }

      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(result.nextState);

      if (saveRes.ok) {
        setState(result.nextState);
        refreshMetrics();
        return result;
      } else {
        setError(saveRes.error);
        return null;
      }
    },
    [state, refreshMetrics]
  );

  // -------------------------------------------------------------
  // Habit Actions
  // -------------------------------------------------------------

  const addHabit = useCallback(
    (input: CreateHabitInput): boolean => {
      if (!state) return false;

      const { nextState } = createHabit(state, input);
      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(nextState);

      if (saveRes.ok) {
        setState(nextState);
        refreshMetrics();
        return true;
      } else {
        setError(saveRes.error);
        return false;
      }
    },
    [state, refreshMetrics]
  );

  const finishHabit = useCallback(
    (habitId: string, customDate?: string): CompleteHabitResult | null => {
      if (!state) return null;

      const result = completeHabit(state, habitId, customDate);
      if (!result.habitCompleted) {
        // Idempotent same-day no-op
        return result;
      }

      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(result.nextState);

      if (saveRes.ok) {
        setState(result.nextState);
        refreshMetrics();
        return result;
      } else {
        setError(saveRes.error);
        return null;
      }
    },
    [state, refreshMetrics]
  );

  const removeHabit = useCallback(
    (habitId: string): boolean => {
      if (!state) return false;

      const { nextState, habitDeleted } = deleteHabit(state, habitId);
      if (!habitDeleted) return false;

      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(nextState);

      if (saveRes.ok) {
        setState(nextState);
        refreshMetrics();
        return true;
      } else {
        setError(saveRes.error);
        return false;
      }
    },
    [state, refreshMetrics]
  );

  // -------------------------------------------------------------
  // Skill Actions
  // -------------------------------------------------------------

  const assignSkillPoint = useCallback(
    (skillId: string): AllocateSkillPointResult | null => {
      if (!state) return null;

      const result = allocateSkillPoint(state, skillId);
      if (!result.skillUpgraded) {
        return result;
      }

      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(result.nextState);

      if (saveRes.ok) {
        setState(result.nextState);
        refreshMetrics();
        return result;
      } else {
        setError(saveRes.error);
        return null;
      }
    },
    [state, refreshMetrics]
  );

  // -------------------------------------------------------------
  // Data / Vault Actions
  // -------------------------------------------------------------

  const exportData = useCallback((): string | null => {
    if (!state) return null;
    return exportBackup(state);
  }, [state]);

  const importData = useCallback(
    (jsonString: string, confirmOverwrite: boolean): Result<AppState, StorageError> => {
      const { adapter } = getStorageInstances();
      const importRes = importBackup(adapter, jsonString, { confirmOverwrite });

      if (importRes.ok) {
        setState(importRes.data);
        setError(null);
        refreshMetrics();
      } else {
        setError(importRes.error);
      }

      return importRes;
    },
    [refreshMetrics]
  );

  const resetDefaults = useCallback((): boolean => {
    const { manager } = getStorageInstances();
    const resetRes = manager.resetToDefaults({ confirmReset: true });
    if (resetRes.ok) {
      setState(resetRes.data);
      setError(null);
      refreshMetrics();
      return true;
    } else {
      setError(resetRes.error);
      return false;
    }
  }, [refreshMetrics]);

  return {
    state,
    isHydrated,
    error,
    metrics,
    levelProgress,
    addTask,
    editTask,
    removeTask,
    finishTask,
    addHabit,
    finishHabit,
    removeHabit,
    assignSkillPoint,
    exportData,
    importData,
    resetDefaults,
    refreshMetrics,
  };
}
