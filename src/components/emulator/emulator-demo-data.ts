/**
 * iPhone 17 Pro Emulator Demo Data
 *
 * Provides rich, realistic test data for the Personal Progression App
 * to instantly verify all HUD widgets, radar charts, season ranks, quests,
 * habits, and WHOOP health boundaries.
 */

import type { AppState } from "@/domain/types";
import type { StorageEnvelope } from "@/storage/types";
import { CURRENT_SCHEMA_VERSION } from "@/storage/schema";
import { DEFAULT_STAT_DEFINITIONS } from "@/domain/defaults";
import { nowUtc } from "@/domain/date-time";
import { createInitialSeasonRankState } from "@/domain/season-rank";
import { createInitialStudyTimerState } from "@/domain/study-timer";

export function createDemoAppState(): AppState {
  const now = nowUtc();
  const today = now.slice(0, 10);

  const statsRecord: Record<string, { current: number; lifetimeEarned: number }> = {
    discipline: { current: 45, lifetimeEarned: 65 },
    knowledge: { current: 38, lifetimeEarned: 52 },
    vitality: { current: 32, lifetimeEarned: 44 },
    focus: { current: 40, lifetimeEarned: 58 },
    creativity: { current: 22, lifetimeEarned: 30 },
    social: { current: 18, lifetimeEarned: 24 },
  };

  const initialRank = createInitialSeasonRankState(now, "America/Los_Angeles");

  return {
    progression: {
      totalXp: 1850,
      level: 7,
      availableSkillPoints: 3,
      lifetimeCompletedTasks: 18,
      lifetimeHabitCompletions: 42,
    },
    seasonRank: {
      ...initialRank,
      tier: "gold",
      division: "II",
      sr: 620,
      seasonalPeakTier: "gold",
      seasonalPeakDivision: "II",
      allTimePeakTier: "gold",
      allTimePeakDivision: "II",
      provisionalActivitiesCount: 10,
      isProvisional: false,
    },
    statDefinitions: [...DEFAULT_STAT_DEFINITIONS],
    stats: statsRecord,
    skills: [
      {
        id: "deep_work",
        name: "Deep Work Flow",
        description: "Sustained high-cognitive focus without distraction.",
        linkedStatIds: ["discipline", "focus"],
        xp: 350,
        level: 3,
      },
      {
        id: "physical_readiness",
        name: "Physical Readiness",
        description: "Cardiovascular endurance and resistance training.",
        linkedStatIds: ["vitality"],
        xp: 220,
        level: 2,
      },
      {
        id: "algorithmic_mastery",
        name: "Algorithmic Mastery",
        description: "Computational problem-solving and systems design.",
        linkedStatIds: ["knowledge", "focus"],
        xp: 180,
        level: 2,
      },
      {
        id: "creative_synthesis",
        name: "Creative Synthesis",
        description: "Rapid ideation, visual writing, and interface architecture.",
        linkedStatIds: ["creativity"],
        xp: 90,
        level: 1,
      },
    ],
    tasks: [
      {
        id: "task_demo_1",
        title: "Architect iPhone 17 Pro emulator workbench",
        notes: "Build realistic titanium bezel, dynamic island, and safe area guides.",
        status: "pending",
        priority: "urgent",
        dueDate: today,
        xpReward: 120,
        statRewards: { discipline: 15, focus: 10 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "task_demo_2",
        title: "Review WHOOP biometric recovery bounds",
        notes: "Calibrate sleep performance and HRV strain thresholds.",
        status: "pending",
        priority: "high",
        dueDate: today,
        xpReward: 80,
        statRewards: { vitality: 12 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "task_demo_3",
        title: "Complete daily distributed systems chapter",
        notes: "Read raft consensus protocol and log compaction algorithms.",
        status: "pending",
        priority: "medium",
        dueDate: today,
        xpReward: 60,
        statRewards: { knowledge: 10 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "task_demo_4",
        title: "Refactor core UI liquid glass token hierarchy",
        notes: "Inspect contrast ratios across high-DPI OLED screens.",
        status: "pending",
        priority: "low",
        dueDate: today,
        xpReward: 40,
        statRewards: { creativity: 8 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "task_demo_completed_1",
        title: "Initialize Next.js 15 zero-server static pipeline",
        status: "completed",
        priority: "high",
        xpReward: 100,
        statRewards: { discipline: 10, knowledge: 10 },
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      },
    ],
    habits: [
      {
        id: "habit_demo_1",
        title: "Morning Sun & Electrolytes",
        description: "15 minutes sunlight exposure within 30 minutes of waking.",
        frequency: "daily",
        streakCurrent: 14,
        streakBest: 21,
        lastCompletedDate: today,
        xpReward: 35,
        statRewards: { vitality: 5 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "habit_demo_2",
        title: "45-Minute Deep Study Block",
        description: "Deliberate practice with zero tab switching or notifications.",
        frequency: "daily",
        streakCurrent: 8,
        streakBest: 15,
        lastCompletedDate: today,
        xpReward: 50,
        statRewards: { knowledge: 8, focus: 5 },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "habit_demo_3",
        title: "Evening Cold Down & Log Review",
        description: "Reflect on completed tasks and prepare next day's queue.",
        frequency: "daily",
        streakCurrent: 5,
        streakBest: 9,
        lastCompletedDate: undefined,
        xpReward: 30,
        statRewards: { discipline: 6 },
        createdAt: now,
        updatedAt: now,
      },
    ],
    activityLogs: [
      {
        id: "log_demo_1",
        type: "task",
        referenceId: "task_demo_completed_1",
        title: "Initialize Next.js 15 zero-server static pipeline",
        timestamp: now,
        xpEarned: 100,
        statDeltas: { discipline: 10, knowledge: 10 },
      },
      {
        id: "log_demo_2",
        type: "habit",
        referenceId: "habit_demo_1",
        title: "Morning Sun & Electrolytes",
        timestamp: now,
        xpEarned: 35,
        statDeltas: { vitality: 5 },
      },
    ],
    settings: {
      timeZone: "America/Los_Angeles",
      dailyResetHour: 4,
      maxLogRetention: 100,
    },
    studyTimer: createInitialStudyTimerState(),
  };
}

export function injectDemoData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const demoState = createDemoAppState();

    const envelope: StorageEnvelope<AppState> = {
      version: CURRENT_SCHEMA_VERSION,
      updatedAt: nowUtc(),
      state: demoState,
    };

    localStorage.setItem("personal_app:state", JSON.stringify(envelope));
    window.dispatchEvent(new Event("storage"));
    return true;
  } catch (err) {
    console.error("Failed to inject demo data:", err);
    return false;
  }
}
