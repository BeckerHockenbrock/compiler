"use client";

/**
 * React Application Store & Storage Bridge
 *
 * Provides reactive access to AppState, ensures hydration safety on static export,
 * and automatically persists all domain state changes via StorageManager.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  AppState,
  PromotionTrialStatus,
  StudyTimerDurationMinutes,
  StudyTimerActionResult,
  CompletedStudySessionSummary,
} from "@/domain/types";
import { calculateLevel, type LevelProgress } from "@/domain/progression";
import {
  checkAndApplySeasonRollover,
  evaluatePromotionTrial,
  findLadderIndex,
  getRankRung,
} from "@/domain/season-rank";
import {
  reconcileStudyTimer,
  startStudyTimerWithReconciliation,
  pauseStudyTimerWithReconciliation,
  resumeStudyTimerWithReconciliation,
  cancelStudyTimerWithReconciliation,
} from "@/domain/study-timer";
import { toLocalDate, nowUtc } from "@/domain/date-time";
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
  readonly promotionTrial: PromotionTrialStatus | null;
  readonly reconcileRollover: () => void;

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

  // Timer Actions
  readonly startTimer: (durationMinutes: StudyTimerDurationMinutes) => StudyTimerActionResult;
  readonly pauseTimer: () => StudyTimerActionResult;
  readonly resumeTimer: () => StudyTimerActionResult;
  readonly cancelTimer: () => StudyTimerActionResult;
  readonly reconcileTimer: () => CompletedStudySessionSummary | null;
  readonly lastCompletedSession: CompletedStudySessionSummary | null;
  readonly clearCompletionSummary: () => void;

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
  const [lastCompletedSession, setLastCompletedSession] = useState<CompletedStudySessionSummary | null>(null);

  const clearCompletionSummary = useCallback(() => {
    setLastCompletedSession(null);
  }, []);

  const refreshMetrics = useCallback(() => {
    const { adapter } = getStorageInstances();
    const metricsRes = adapter.getEstimatedMetrics();
    if (metricsRes.ok) {
      setMetrics(metricsRes.data);
    }
  }, []);

  // Reconcile monthly rollover safely
  const reconcileRollover = useCallback(() => {
    setState((currentState) => {
      if (!currentState) return currentState;
      const { nextState, rolledOver } = checkAndApplySeasonRollover(currentState);
      if (rolledOver) {
        const { manager } = getStorageInstances();
        manager.saveState(nextState);
        return nextState;
      }
      return currentState;
    });
  }, []);

  // Reconcile study timer completion safely
  const reconcileTimer = useCallback((): CompletedStudySessionSummary | null => {
    let completedSummary: CompletedStudySessionSummary | null = null;
    setState((currentState) => {
      if (!currentState) return currentState;
      const { nextState, sessionCompleted, summary } = reconcileStudyTimer(currentState);
      if (sessionCompleted && summary) {
        completedSummary = summary;
        setLastCompletedSession(summary);
        const { manager } = getStorageInstances();
        const saveRes = manager.saveState(nextState);
        if (saveRes.ok) {
          refreshMetrics();
          return nextState;
        } else {
          setError(saveRes.error);
          return currentState;
        }
      }
      return currentState;
    });
    return completedSummary;
  }, [refreshMetrics]);

  // Load state upon client mount to avoid SSR hydration mismatches and reconcile rollover & timer
  useEffect(() => {
    const { manager } = getStorageInstances();
    const result = manager.loadState();

    if (result.ok) {
      let effectiveState = result.data;
      const { nextState: afterRollover, rolledOver } = checkAndApplySeasonRollover(effectiveState);
      if (rolledOver) {
        effectiveState = afterRollover;
      }
      const { nextState: afterTimer, sessionCompleted, summary } = reconcileStudyTimer(effectiveState);
      if (sessionCompleted && summary) {
        effectiveState = afterTimer;
        setLastCompletedSession(summary);
      }
      if (rolledOver || sessionCompleted) {
        manager.saveState(effectiveState);
      }
      setState(effectiveState);
      setError(null);
    } else {
      setError(result.error);
    }
    refreshMetrics();
    setIsHydrated(true);
  }, [refreshMetrics]);

  // Event listeners for window focus and document visibilitychange
  useEffect(() => {
    const handleReconcile = () => {
      reconcileRollover();
      reconcileTimer();
    };

    window.addEventListener("focus", handleReconcile);
    document.addEventListener("visibilitychange", handleReconcile);
    const interval = setInterval(handleReconcile, 60000);

    return () => {
      window.removeEventListener("focus", handleReconcile);
      document.removeEventListener("visibilitychange", handleReconcile);
      clearInterval(interval);
    };
  }, [reconcileRollover, reconcileTimer]);

  // Compute current leveling progress derived from state
  const levelProgress = useMemo(() => {
    if (!state) return null;
    return calculateLevel(state.progression.totalXp);
  }, [state]);

  // Compute promotion trial status derived from state
  const promotionTrial = useMemo(() => {
    if (!state) return null;
    const currentRungIdx = findLadderIndex(state.seasonRank.tier, state.seasonRank.division);
    const nextRung = getRankRung(currentRungIdx + 1);
    const localDate = toLocalDate(nowUtc(), state.settings.timeZone);
    return evaluatePromotionTrial(
      state.seasonRank,
      nextRung.tier,
      localDate,
      state.settings.timeZone
    );
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

      // Reconcile rollover immediately before finishing task so cross-midnight
      // completions are never credited to an un-reconciled season
      const rollover = checkAndApplySeasonRollover(state);
      const stateToUse = rollover.rolledOver ? rollover.nextState : state;

      const result = completeTask(stateToUse, taskId);
      if (!result.taskCompleted) {
        // Even if task was not completed, persist rollover if it occurred
        if (rollover.rolledOver) {
          const { manager } = getStorageInstances();
          manager.saveState(stateToUse);
          setState(stateToUse);
        }
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

      // Reconcile rollover immediately before completing habit so cross-midnight
      // completions are never credited to an un-reconciled season
      const rollover = checkAndApplySeasonRollover(state);
      const stateToUse = rollover.rolledOver ? rollover.nextState : state;

      const result = completeHabit(stateToUse, habitId, customDate);
      if (!result.habitCompleted) {
        // Even if habit was already checked in today, persist rollover if it occurred
        if (rollover.rolledOver) {
          const { manager } = getStorageInstances();
          manager.saveState(stateToUse);
          setState(stateToUse);
        }
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

  // -------------------------------------------------------------
  // Study Timer Actions
  // -------------------------------------------------------------

  const startTimer = useCallback(
    (durationMinutes: StudyTimerDurationMinutes): StudyTimerActionResult => {
      if (!state) return "noop";

      const { nextState, result, summary } = startStudyTimerWithReconciliation(
        state,
        durationMinutes
      );
      if (result === "noop" && !summary) return "noop";

      if (summary) {
        setLastCompletedSession(summary);
      }

      const { manager } = getStorageInstances();
      const saveRes = manager.saveState(nextState);

      if (saveRes.ok) {
        setState(nextState);
        refreshMetrics();
        return result;
      } else {
        setError(saveRes.error);
        return "noop";
      }
    },
    [state, refreshMetrics]
  );

  const pauseTimer = useCallback((): StudyTimerActionResult => {
    if (!state) return "noop";

    const { nextState, result, summary } = pauseStudyTimerWithReconciliation(state);
    if (result === "noop") return "noop";

    if (summary) {
      setLastCompletedSession(summary);
    }

    const { manager } = getStorageInstances();
    const saveRes = manager.saveState(nextState);

    if (saveRes.ok) {
      setState(nextState);
      refreshMetrics();
      return result;
    } else {
      setError(saveRes.error);
      return "noop";
    }
  }, [state, refreshMetrics]);

  const resumeTimer = useCallback((): StudyTimerActionResult => {
    if (!state) return "noop";

    const { nextState, result, summary } = resumeStudyTimerWithReconciliation(state);
    if (result === "noop") return "noop";

    if (summary) {
      setLastCompletedSession(summary);
    }

    const { manager } = getStorageInstances();
    const saveRes = manager.saveState(nextState);

    if (saveRes.ok) {
      setState(nextState);
      refreshMetrics();
      return result;
    } else {
      setError(saveRes.error);
      return "noop";
    }
  }, [state, refreshMetrics]);

  const cancelTimer = useCallback((): StudyTimerActionResult => {
    if (!state) return "noop";

    const { nextState, result, summary } = cancelStudyTimerWithReconciliation(state);
    if (result === "noop") return "noop";

    if (summary) {
      setLastCompletedSession(summary);
    }

    const { manager } = getStorageInstances();
    const saveRes = manager.saveState(nextState);

    if (saveRes.ok) {
      setState(nextState);
      refreshMetrics();
      return result;
    } else {
      setError(saveRes.error);
      return "noop";
    }
  }, [state, refreshMetrics]);

  return {
    state,
    isHydrated,
    error,
    metrics,
    levelProgress,
    promotionTrial,
    reconcileRollover,
    reconcileTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    lastCompletedSession,
    clearCompletionSummary,
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
