/**
 * Initial Domain Defaults & Safe Fallback Seeds
 */

import type { AppState, StatDefinition, Skill, Task, Habit } from "./types";
import { nowUtc } from "./date-time";
import { createInitialSeasonRankState } from "./season-rank";
import { createInitialStudyTimerState } from "./study-timer";

export const DEFAULT_STAT_DEFINITIONS: readonly StatDefinition[] = [
  {
    id: "discipline",
    name: "Discipline",
    description: "Consistency, focus, habit adherence, and impulse control.",
  },
  {
    id: "knowledge",
    name: "Knowledge",
    description: "Deep study, reading, retention, and conceptual mastery.",
  },
  {
    id: "vitality",
    name: "Vitality",
    description: "Physical health, endurance, recovery, and daily energy.",
  },
  {
    id: "focus",
    name: "Focus",
    description: "Attentive presence, flow state, and cognitive endurance.",
  },
  {
    id: "creativity",
    name: "Creativity",
    description: "Synthesis, writing, design, and inventive problem solving.",
  },
  {
    id: "social",
    name: "Social",
    description: "Communication, relationship building, and collaborative presence.",
  },
];

export function createInitialAppState(): AppState {
  const timestamp = nowUtc();

  const statsRecord: Record<string, { current: number; lifetimeEarned: number }> =
    {};
  for (const def of DEFAULT_STAT_DEFINITIONS) {
    statsRecord[def.id] = { current: 0, lifetimeEarned: 0 };
  }

  const initialSkills: Skill[] = [
    {
      id: "deep_work",
      name: "Deep Work",
      description: "Sustained high-cognitive focus without distraction.",
      linkedStatIds: ["discipline", "knowledge"],
      xp: 0,
      level: 1,
    },
    {
      id: "physical_readiness",
      name: "Physical Readiness",
      description: "Regular cardiovascular and resistance activity.",
      linkedStatIds: ["vitality"],
      xp: 0,
      level: 1,
    },
  ];

  const initialTasks: Task[] = [
    {
      id: "task_welcome",
      title: "Complete repository architecture setup",
      notes: "Verify domain tests, storage isolation, and static export build.",
      status: "pending",
      priority: "high",
      xpReward: 100,
      statRewards: { discipline: 10, knowledge: 10 },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const initialHabits: Habit[] = [
    {
      id: "habit_daily_study",
      title: "Daily Focused Study",
      description: "At least 45 minutes of deliberate learning.",
      frequency: "daily",
      streakCurrent: 0,
      streakBest: 0,
      xpReward: 50,
      statRewards: { knowledge: 5, discipline: 5 },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  return {
    progression: {
      totalXp: 0,
      level: 1,
      availableSkillPoints: 0,
      lifetimeCompletedTasks: 0,
      lifetimeHabitCompletions: 0,
    },
    stats: statsRecord,
    statDefinitions: DEFAULT_STAT_DEFINITIONS,
    skills: initialSkills,
    tasks: initialTasks,
    habits: initialHabits,
    activityLogs: [],
    settings: {
      timeZone: (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        } catch {
          return "UTC";
        }
      })(),
      dailyResetHour: 0,
      maxLogRetention: 500,
    },
    seasonRank: createInitialSeasonRankState(
      timestamp,
      (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        } catch {
          return "UTC";
        }
      })()
    ),
    studyTimer: createInitialStudyTimerState(),
  };
}
