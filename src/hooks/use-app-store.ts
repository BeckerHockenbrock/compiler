"use client";

/**
 * React Application Store & Storage Bridge
 *
 * Provides reactive access to AppState, ensures hydration safety on static export,
 * and automatically persists all domain state changes via StorageManager.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { AppState, TaskPriority } from "@/domain/types";
import { calculateLevel, type LevelProgress } from "@/domain/progression";
import { createTask, completeTask, type CompleteTaskResult } from "@/domain/tasks";
import { StorageManager } from "@/storage/storage-manager";
import { NamespacedLocalStorageAdapter } from "@/storage/adapter";
import type { StorageError } from "@/storage/types";

// Singleton storage manager instance for the browser session
let storageManagerInstance: StorageManager | null = null;

function getStorageManager(): StorageManager {
  if (!storageManagerInstance) {
    const adapter = new NamespacedLocalStorageAdapter();
    storageManagerInstance = new StorageManager(adapter);
  }
  return storageManagerInstance;
}

export interface UseAppStoreReturn {
  readonly state: AppState | null;
  readonly isHydrated: boolean;
  readonly error: StorageError | null;
  readonly levelProgress: LevelProgress | null;
  readonly addTask: (input: {
    title: string;
    priority: TaskPriority;
    xpReward: number;
    statRewards?: Record<string, number>;
    notes?: string;
  }) => boolean;
  readonly finishTask: (taskId: string) => CompleteTaskResult | null;
  readonly resetDefaults: () => boolean;
}

export function useAppStore(): UseAppStoreReturn {
  const [state, setState] = useState<AppState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<StorageError | null>(null);

  // Load state upon client mount to avoid SSR hydration mismatches
  useEffect(() => {
    const manager = getStorageManager();
    const result = manager.loadState();

    if (result.ok) {
      setState(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsHydrated(true);
  }, []);

  // Compute current leveling progress derived from state
  const levelProgress = useMemo(() => {
    if (!state) return null;
    return calculateLevel(state.progression.totalXp);
  }, [state]);

  // Action: Add a new task
  const addTask = useCallback(
    (input: {
      title: string;
      priority: TaskPriority;
      xpReward: number;
      statRewards?: Record<string, number>;
      notes?: string;
    }): boolean => {
      if (!state) return false;

      const { nextState } = createTask(state, input);
      const manager = getStorageManager();
      const saveRes = manager.saveState(nextState);

      if (saveRes.ok) {
        setState(nextState);
        return true;
      } else {
        setError(saveRes.error);
        return false;
      }
    },
    [state]
  );

  // Action: Complete a task idempotently
  const finishTask = useCallback(
    (taskId: string): CompleteTaskResult | null => {
      if (!state) return null;

      const result = completeTask(state, taskId);
      if (!result.taskCompleted) {
        // Idempotent no-op (task already completed or not found)
        return result;
      }

      const manager = getStorageManager();
      const saveRes = manager.saveState(result.nextState);

      if (saveRes.ok) {
        setState(result.nextState);
        return result;
      } else {
        setError(saveRes.error);
        return null;
      }
    },
    [state]
  );

  // Action: Explicit Reset
  const resetDefaults = useCallback((): boolean => {
    const manager = getStorageManager();
    const resetRes = manager.resetToDefaults({ confirmReset: true });
    if (resetRes.ok) {
      setState(resetRes.data);
      setError(null);
      return true;
    } else {
      setError(resetRes.error);
      return false;
    }
  }, []);

  return {
    state,
    isHydrated,
    error,
    levelProgress,
    addTask,
    finishTask,
    resetDefaults,
  };
}
