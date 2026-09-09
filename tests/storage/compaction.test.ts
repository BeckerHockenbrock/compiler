import { describe, it, expect } from "vitest";
import { checkRetentionStatus, compactActivityLogs } from "@/storage/compaction";
import { createInitialAppState } from "@/domain/defaults";
import type { ActivityLog } from "@/domain/types";

describe("Storage: Log Retention & Compaction Policy", () => {
  function generateMockLogs(count: number): ActivityLog[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `log_${i}`,
      type: "task" as const,
      title: `Task ${i}`,
      timestamp: `2026-09-08T12:${String(i % 60).padStart(2, "0")}:00.000Z`,
      xpEarned: 25,
      statDeltas: { discipline: 5 },
    }));
  }

  it("evaluates retention status transparently against settings limit", () => {
    const state = {
      ...createInitialAppState(),
      activityLogs: generateMockLogs(550),
      settings: {
        timeZone: "UTC",
        dailyResetHour: 0,
        maxLogRetention: 500,
      },
    };

    const status = checkRetentionStatus(state);
    expect(status.isOverLimit).toBe(true);
    expect(status.currentCount).toBe(550);
    expect(status.maxRetention).toBe(500);
  });

  it("compacts logs to retention limit while preserving all progression aggregates intact", () => {
    const initial = createInitialAppState();
    const stateWithLogs = {
      ...initial,
      progression: {
        totalXp: 12500,
        level: 12,
        availableSkillPoints: 4,
        lifetimeCompletedTasks: 45,
        lifetimeHabitCompletions: 30,
      },
      activityLogs: generateMockLogs(600),
      settings: {
        ...initial.settings,
        maxLogRetention: 500,
      },
    };

    const { compactedState, report } = compactActivityLogs(stateWithLogs);

    expect(report.previousLogCount).toBe(600);
    expect(report.newLogCount).toBe(500);
    expect(report.prunedCount).toBe(100);

    // CRUCIAL: All domain aggregates remain completely intact
    expect(compactedState.progression.totalXp).toBe(12500);
    expect(compactedState.progression.level).toBe(12);
    expect(compactedState.progression.availableSkillPoints).toBe(4);
    expect(compactedState.progression.lifetimeCompletedTasks).toBe(45);
    expect(compactedState.progression.lifetimeHabitCompletions).toBe(30);
    expect(compactedState.activityLogs.length).toBe(500);
  });

  it("does not prune logs if count is within retention threshold", () => {
    const state = {
      ...createInitialAppState(),
      activityLogs: generateMockLogs(300),
    };

    const { compactedState, report } = compactActivityLogs(state);
    expect(report.prunedCount).toBe(0);
    expect(compactedState.activityLogs.length).toBe(300);
  });
});
