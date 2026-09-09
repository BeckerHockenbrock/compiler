import { describe, it, expect } from "vitest";
import { allocateSkillPoint } from "@/domain/skills";
import { createInitialAppState } from "@/domain/defaults";

describe("Domain: Skills & Skill Point Allocation", () => {
  it("rejects skill point allocation when availableSkillPoints is 0", () => {
    const state = createInitialAppState();
    expect(state.progression.availableSkillPoints).toBe(0);

    const result = allocateSkillPoint(state, "deep_work");
    expect(result.skillUpgraded).toBe(false);
    expect(result.error).toContain("No available skill points");
    expect(result.nextState).toBe(state);
  });

  it("successfully upgrades skill, decrements skill point, and buffs linked stats", () => {
    const initial = createInitialAppState();
    // Simulate user having 2 available skill points
    const stateWithPoints = {
      ...initial,
      progression: {
        ...initial.progression,
        availableSkillPoints: 2,
      },
    };

    const result = allocateSkillPoint(stateWithPoints, "deep_work");
    expect(result.skillUpgraded).toBe(true);
    expect(result.updatedSkill?.level).toBe(2);
    expect(result.updatedSkill?.xp).toBe(100);

    // Progression has 1 point remaining
    expect(result.nextState.progression.availableSkillPoints).toBe(1);

    // Linked stats for deep_work: discipline and knowledge
    expect(result.nextState.stats.discipline?.current).toBe(5);
    expect(result.nextState.stats.knowledge?.current).toBe(5);

    // Activity log recorded
    expect(result.nextState.activityLogs.length).toBe(1);
    expect(result.nextState.activityLogs[0].title).toContain("Ranked up skill: Deep Work");
  });

  it("fails safely if skill ID does not exist", () => {
    const state = {
      ...createInitialAppState(),
      progression: {
        ...createInitialAppState().progression,
        availableSkillPoints: 1,
      },
    };

    const result = allocateSkillPoint(state, "non_existent_skill");
    expect(result.skillUpgraded).toBe(false);
    expect(result.error).toContain("not found");
  });
});
