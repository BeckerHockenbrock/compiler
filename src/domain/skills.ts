/**
 * Pure Domain Logic for Skills & Skill Point Allocation
 *
 * Provides a clean, RPG-like mechanism to allocate earned skill points
 * into active skills and their associated attribute stats.
 */

import type { AppState, Skill, StatValue, ActivityLog } from "./types";
import { nowUtc } from "./date-time";

export interface AllocateSkillPointResult {
  readonly nextState: AppState;
  readonly skillUpgraded: boolean;
  readonly updatedSkill?: Skill;
  readonly error?: string;
}

const STAT_BONUS_PER_SKILL_POINT = 5;

/**
 * Allocates 1 available skill point to upgrade a skill and boost its linked attributes.
 */
export function allocateSkillPoint(
  currentState: AppState,
  skillId: string
): AllocateSkillPointResult {
  if (currentState.progression.availableSkillPoints <= 0) {
    return {
      nextState: currentState,
      skillUpgraded: false,
      error: "No available skill points to allocate.",
    };
  }

  const targetSkill = currentState.skills.find((s) => s.id === skillId);
  if (!targetSkill) {
    return {
      nextState: currentState,
      skillUpgraded: false,
      error: `Skill with id "${skillId}" not found.`,
    };
  }

  // 1. Upgrade skill level
  const updatedSkill: Skill = {
    ...targetSkill,
    level: targetSkill.level + 1,
    xp: targetSkill.xp + 100,
  };

  const nextSkills = currentState.skills.map((s) =>
    s.id === skillId ? updatedSkill : s
  );

  // 2. Apply bonus to linked stats
  const updatedStats: Record<string, StatValue> = { ...currentState.stats };
  const statDeltas: Record<string, number> = {};

  for (const statId of targetSkill.linkedStatIds) {
    const existing = updatedStats[statId] ?? { current: 0, lifetimeEarned: 0 };
    updatedStats[statId] = {
      current: existing.current + STAT_BONUS_PER_SKILL_POINT,
      lifetimeEarned: existing.lifetimeEarned + STAT_BONUS_PER_SKILL_POINT,
    };
    statDeltas[statId] = STAT_BONUS_PER_SKILL_POINT;
  }

  // 3. Log the upgrade activity
  const logEntry: ActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "manual",
    referenceId: targetSkill.id,
    title: `Ranked up skill: ${targetSkill.name} (Lv. ${updatedSkill.level})`,
    timestamp: nowUtc(),
    xpEarned: 0,
    statDeltas,
  };

  const nextState: AppState = {
    ...currentState,
    progression: {
      ...currentState.progression,
      availableSkillPoints: currentState.progression.availableSkillPoints - 1,
    },
    skills: nextSkills,
    stats: updatedStats,
    activityLogs: [logEntry, ...currentState.activityLogs],
  };

  return {
    nextState,
    skillUpgraded: true,
    updatedSkill,
  };
}
