import { describe, it, expect } from "vitest";
import { runMigrationsInMemory, registerMigration } from "@/storage/migrations";
import { migrateV2ToV3 } from "@/storage/migrations/v2-to-v3";
import { CURRENT_SCHEMA_VERSION } from "@/storage/schema";
import { createInitialAppState } from "@/domain/defaults";
import { InMemoryStorageFallback, NamespacedLocalStorageAdapter } from "@/storage/adapter";
import { StorageManager } from "@/storage/storage-manager";
import { importBackup } from "@/storage/backup";
import { STATE_KEY } from "@/storage/types";
import { calculateChecksum } from "@/storage/checksum";

describe("Storage: Migrations Engine", () => {
  it("accepts and validates a current schema version (version 3) envelope", () => {
    const validEnvelope = {
      version: CURRENT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      state: createInitialAppState(),
    };

    const result = runMigrationsInMemory(validEnvelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.data.state.progression.level).toBe(1);
      expect(result.data.state.seasonRank).toBeDefined();
      expect(result.data.state.studyTimer).toBeDefined();
      expect(result.data.state.studyTimer.status).toBe("idle");
    }
  });

  it("migrates a version 1 envelope through all sequential steps to current schema version (version 3)", () => {
    // Construct a valid v1 state without seasonRank and without studyTimer
    const initial = createInitialAppState();
    const v1StateWithoutRankOrTimer: Record<string, unknown> = { ...initial };
    delete v1StateWithoutRankOrTimer.seasonRank;
    delete v1StateWithoutRankOrTimer.studyTimer;

    const v1State = {
      ...v1StateWithoutRankOrTimer,
      progression: {
        ...initial.progression,
        totalXp: 850,
        level: 5,
        lifetimeCompletedTasks: 12,
        lifetimeHabitCompletions: 24,
      },
      stats: {
        ...initial.stats,
        discipline: { current: 40, lifetimeEarned: 40 },
        vitality: { current: 35, lifetimeEarned: 35 },
      },
      settings: {
        ...initial.settings,
        timeZone: "America/New_York",
      },
    };

    const v1Envelope = {
      version: 1,
      updatedAt: "2026-08-15T12:00:00.000Z",
      state: v1State,
    };

    const result = runMigrationsInMemory(v1Envelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(3);
      // Verify all v1 progression data is completely preserved
      expect(result.data.state.progression.totalXp).toBe(850);
      expect(result.data.state.progression.level).toBe(5);
      expect(result.data.state.progression.lifetimeCompletedTasks).toBe(12);
      expect(result.data.state.progression.lifetimeHabitCompletions).toBe(24);
      expect(result.data.state.stats.discipline?.current).toBe(40);
      expect(result.data.state.stats.vitality?.current).toBe(35);
      expect(result.data.state.settings.timeZone).toBe("America/New_York");

      // Verify seasonRank was cleanly initialized from v1 -> v2
      const rank = result.data.state.seasonRank;
      expect(rank).toBeDefined();
      expect(rank.tier).toBe("recruit");
      expect(rank.division).toBe("III");
      expect(rank.sr).toBe(0);
      expect(rank.isProvisional).toBe(true);
      expect(rank.weeklyMission).toBeDefined();
      expect(rank.weeklyMission.currentCount).toBe(0);
      expect(rank.history).toEqual([]);

      // Verify studyTimer was cleanly initialized from v2 -> v3
      const timer = result.data.state.studyTimer;
      expect(timer).toBeDefined();
      expect(timer.status).toBe("idle");
      expect(timer.durationMinutes).toBe(25);
      expect(timer.sessionId).toBeNull();
      expect(timer.accumulatedElapsedMs).toBe(0);
    }
  });

  it("migrates a version 2 envelope to version 3, initializing studyTimer and preserving all progression and seasonRank", () => {
    // Construct a valid v2 state with seasonRank, but without studyTimer
    const initial = createInitialAppState();
    const v2StateWithoutTimer: Record<string, unknown> = { ...initial };
    delete v2StateWithoutTimer.studyTimer;

    const v2State = {
      ...v2StateWithoutTimer,
      progression: {
        ...initial.progression,
        totalXp: 1450,
        level: 8,
        lifetimeCompletedTasks: 20,
        lifetimeHabitCompletions: 35,
      },
      stats: {
        ...initial.stats,
        discipline: { current: 65, lifetimeEarned: 65 },
        knowledge: { current: 50, lifetimeEarned: 50 },
        focus: { current: 30, lifetimeEarned: 30 },
      },
      seasonRank: {
        ...initial.seasonRank,
        tier: "gold" as const,
        division: "II" as const,
        sr: 45,
        seasonalPeakTier: "gold" as const,
        seasonalPeakDivision: "II" as const,
        isProvisional: false,
        provisionalActivitiesCount: 3,
      },
    };

    const v2Envelope = {
      version: 2,
      updatedAt: "2026-09-01T12:00:00.000Z",
      state: v2State,
    };

    const result = runMigrationsInMemory(v2Envelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(3);

      // Verify all v2 progression data remains strictly intact
      expect(result.data.state.progression.totalXp).toBe(1450);
      expect(result.data.state.progression.level).toBe(8);
      expect(result.data.state.stats.discipline?.current).toBe(65);
      expect(result.data.state.stats.knowledge?.current).toBe(50);
      expect(result.data.state.stats.focus?.current).toBe(30);

      // Verify all v2 Season Rank data remains strictly intact
      expect(result.data.state.seasonRank.tier).toBe("gold");
      expect(result.data.state.seasonRank.division).toBe("II");
      expect(result.data.state.seasonRank.sr).toBe(45);
      expect(result.data.state.seasonRank.isProvisional).toBe(false);

      // Verify studyTimer was cleanly initialized to default idle state
      expect(result.data.state.studyTimer).toBeDefined();
      expect(result.data.state.studyTimer.status).toBe("idle");
      expect(result.data.state.studyTimer.durationMinutes).toBe(25);
      expect(result.data.state.studyTimer.sessionId).toBeNull();
      expect(result.data.state.studyTimer.segmentStartedAt).toBeNull();
      expect(result.data.state.studyTimer.accumulatedElapsedMs).toBe(0);
    }
  });

  it("proves migrateV2ToV3 pure function correctly attaches default idle studyTimer", () => {
    const initial = createInitialAppState();
    const v2StateWithoutTimer: Record<string, unknown> = { ...initial };
    delete v2StateWithoutTimer.studyTimer;

    const migrated = migrateV2ToV3(v2StateWithoutTimer);
    expect(migrated.studyTimer).toBeDefined();
    expect(migrated.studyTimer.status).toBe("idle");
    expect(migrated.studyTimer.durationMinutes).toBe(25);
    expect(migrated.studyTimer.sessionId).toBeNull();
    expect(migrated.progression).toEqual(initial.progression);
    expect(migrated.seasonRank).toEqual(initial.seasonRank);
  });

  it("migrates and restores a valid v2 backup to v3 without losing any Ranked or progression data", () => {
    const backingStorage = new InMemoryStorageFallback();
    const adapter = new NamespacedLocalStorageAdapter(backingStorage);

    // Build a genuine v2 state and envelope
    const initial = createInitialAppState();
    const v2StateWithoutTimer: Record<string, unknown> = { ...initial };
    delete v2StateWithoutTimer.studyTimer;

    const v2State = {
      ...v2StateWithoutTimer,
      progression: {
        ...initial.progression,
        totalXp: 2100,
        level: 10,
        lifetimeCompletedTasks: 30,
        lifetimeHabitCompletions: 40,
      },
      seasonRank: {
        ...initial.seasonRank,
        tier: "platinum" as const,
        division: "I" as const,
        sr: 85,
        isProvisional: false,
      },
    };

    const v2Envelope = {
      version: 2,
      updatedAt: "2026-09-05T00:00:00.000Z",
      state: v2State,
    };

    const serializedEnvelope = JSON.stringify(v2Envelope);
    const checksum = calculateChecksum(serializedEnvelope);

    const v2BackupJson = JSON.stringify({
      app: "personal_progression_app",
      formatVersion: 1,
      exportedAt: "2026-09-05T00:00:00.000Z",
      checksum,
      envelope: v2Envelope,
    });

    const importResult = importBackup(adapter, v2BackupJson, { confirmOverwrite: true });
    expect(importResult.ok).toBe(true);
    if (importResult.ok) {
      expect(importResult.data.progression.totalXp).toBe(2100);
      expect(importResult.data.progression.level).toBe(10);
      expect(importResult.data.seasonRank.tier).toBe("platinum");
      expect(importResult.data.seasonRank.division).toBe("I");
      expect(importResult.data.seasonRank.sr).toBe(85);

      // Verify studyTimer was attached upon migration
      expect(importResult.data.studyTimer).toBeDefined();
      expect(importResult.data.studyTimer.status).toBe("idle");
      expect(importResult.data.studyTimer.durationMinutes).toBe(25);
    }
  });

  it("upgrades legacy default UTC timezone to browser timezone upon migration", () => {
    const initial = createInitialAppState();
    const v1StateWithoutRank: Record<string, unknown> = { ...initial };
    delete v1StateWithoutRank.seasonRank;
    delete v1StateWithoutRank.studyTimer;

    const v1State = {
      ...v1StateWithoutRank,
      settings: {
        ...initial.settings,
        timeZone: "UTC", // old legacy default
      },
    };

    const v1Envelope = {
      version: 1,
      updatedAt: "2026-08-15T12:00:00.000Z",
      state: v1State,
    };

    const result = runMigrationsInMemory(v1Envelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const expectedBrowserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      expect(result.data.state.settings.timeZone).toBe(expectedBrowserTz);
    }
  });

  it("rejects non-object or invalid version envelopes", () => {
    expect(runMigrationsInMemory(null).ok).toBe(false);
    expect(runMigrationsInMemory("invalid string").ok).toBe(false);
    expect(runMigrationsInMemory({ version: -1 }).ok).toBe(false);
    expect(runMigrationsInMemory({ version: "abc" }).ok).toBe(false);
  });

  it("rejects envelopes from future app versions", () => {
    const futureEnvelope = {
      version: CURRENT_SCHEMA_VERSION + 1,
      updatedAt: new Date().toISOString(),
      state: createInitialAppState(),
    };

    const result = runMigrationsInMemory(futureEnvelope);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_BACKUP");
    }
  });

  it("executes registered migration steps when upgrading an older version", () => {
    // Register a mock migration from version 0 to version 1
    registerMigration(0, (oldState: unknown) => {
      const stateObj = oldState as Record<string, unknown>;
      const initial = createInitialAppState();
      return {
        ...initial,
        progression: {
          ...initial.progression,
          totalXp: Number(stateObj.legacyPoints ?? 50),
        },
      };
    });

    const v0Envelope = {
      version: 0,
      updatedAt: new Date().toISOString(),
      state: { legacyPoints: 250 },
    };

    const result = runMigrationsInMemory(v0Envelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.data.state.progression.totalXp).toBe(250);
      expect(result.data.state.seasonRank).toBeDefined();
      expect(result.data.state.studyTimer).toBeDefined();
    }
  });
});

describe("Storage: StorageManager Migration Write-Back", () => {
  it("persists upgraded v3 envelope back to storage upon loading a v1 envelope", () => {
    const backingStorage = new InMemoryStorageFallback();
    const adapter = new NamespacedLocalStorageAdapter(backingStorage);
    const manager = new StorageManager(adapter);

    // Seed storage with a v1 envelope
    const initial = createInitialAppState();
    const v1StateWithoutRank: Record<string, unknown> = { ...initial };
    delete v1StateWithoutRank.seasonRank;
    delete v1StateWithoutRank.studyTimer;
    const v1Payload = JSON.stringify({
      version: 1,
      updatedAt: "2026-08-01T00:00:00.000Z",
      state: {
        ...v1StateWithoutRank,
        progression: {
          ...initial.progression,
          totalXp: 999,
          level: 6,
        },
      },
    });

    adapter.setItem(STATE_KEY, v1Payload);

    // Loading state should succeed and trigger write-back to storage
    const loadResult = manager.loadState();
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.data.progression.totalXp).toBe(999);
      expect(loadResult.data.seasonRank).toBeDefined();
      expect(loadResult.data.studyTimer).toBeDefined();
    }

    // Check underlying storage: should now contain a version 3 envelope
    const rawStored = adapter.getItem(STATE_KEY);
    expect(rawStored.ok).toBe(true);
    if (rawStored.ok && rawStored.data) {
      const persisted = JSON.parse(rawStored.data);
      expect(persisted.version).toBe(3);
      expect(persisted.state.progression.totalXp).toBe(999);
      expect(persisted.state.seasonRank).toBeDefined();
      expect(persisted.state.studyTimer).toBeDefined();
      expect(persisted.state.studyTimer.status).toBe("idle");
    }
  });

  it("persists upgraded v3 envelope back to storage upon loading a v2 envelope", () => {
    const backingStorage = new InMemoryStorageFallback();
    const adapter = new NamespacedLocalStorageAdapter(backingStorage);
    const manager = new StorageManager(adapter);

    // Seed storage with a v2 envelope
    const initial = createInitialAppState();
    const v2StateWithoutTimer: Record<string, unknown> = { ...initial };
    delete v2StateWithoutTimer.studyTimer;
    const v2Payload = JSON.stringify({
      version: 2,
      updatedAt: "2026-09-01T00:00:00.000Z",
      state: {
        ...v2StateWithoutTimer,
        progression: {
          ...initial.progression,
          totalXp: 1234,
          level: 7,
        },
        seasonRank: {
          ...initial.seasonRank,
          tier: "silver",
          division: "I",
          sr: 50,
        },
      },
    });

    adapter.setItem(STATE_KEY, v2Payload);

    const loadResult = manager.loadState();
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.data.progression.totalXp).toBe(1234);
      expect(loadResult.data.seasonRank.tier).toBe("silver");
      expect(loadResult.data.studyTimer.status).toBe("idle");
    }

    // Check underlying storage: should now contain a version 3 envelope
    const rawStored = adapter.getItem(STATE_KEY);
    expect(rawStored.ok).toBe(true);
    if (rawStored.ok && rawStored.data) {
      const persisted = JSON.parse(rawStored.data);
      expect(persisted.version).toBe(3);
      expect(persisted.state.progression.totalXp).toBe(1234);
      expect(persisted.state.seasonRank.tier).toBe("silver");
      expect(persisted.state.studyTimer).toBeDefined();
      expect(persisted.state.studyTimer.status).toBe("idle");
    }
  });

  it("leaves storage completely untouched when a corrupt envelope fails migration", () => {
    const backingStorage = new InMemoryStorageFallback();
    const adapter = new NamespacedLocalStorageAdapter(backingStorage);
    const manager = new StorageManager(adapter);

    const corruptPayload = JSON.stringify({
      version: 1,
      updatedAt: "2026-08-01T00:00:00.000Z",
      state: { totally: "corrupt and missing required fields" },
    });

    adapter.setItem(STATE_KEY, corruptPayload);

    const loadResult = manager.loadState();
    expect(loadResult.ok).toBe(false);

    // Stored data must remain strictly identical
    const rawStored = adapter.getItem(STATE_KEY);
    expect(rawStored.ok).toBe(true);
    if (rawStored.ok) {
      expect(rawStored.data).toBe(corruptPayload);
    }
  });
});
