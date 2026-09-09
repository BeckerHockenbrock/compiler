import { describe, it, expect } from "vitest";
import { runMigrationsInMemory, registerMigration } from "@/storage/migrations";
import { CURRENT_SCHEMA_VERSION } from "@/storage/schema";
import { createInitialAppState } from "@/domain/defaults";
import { InMemoryStorageFallback, NamespacedLocalStorageAdapter } from "@/storage/adapter";
import { StorageManager } from "@/storage/storage-manager";
import { STATE_KEY } from "@/storage/types";

describe("Storage: Migrations Engine", () => {
  it("accepts and validates a current schema version (version 2) envelope", () => {
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
    }
  });

  it("migrates a version 1 envelope to version 2, initializing seasonRank and preserving all progression", () => {
    // Construct a valid v1 state without seasonRank
    const initial = createInitialAppState();
    const v1StateWithoutRank: Record<string, unknown> = { ...initial };
    delete v1StateWithoutRank.seasonRank;

    const v1State = {
      ...v1StateWithoutRank,
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
      expect(result.data.version).toBe(2);
      // Verify all v1 progression data is completely preserved
      expect(result.data.state.progression.totalXp).toBe(850);
      expect(result.data.state.progression.level).toBe(5);
      expect(result.data.state.progression.lifetimeCompletedTasks).toBe(12);
      expect(result.data.state.progression.lifetimeHabitCompletions).toBe(24);
      expect(result.data.state.stats.discipline?.current).toBe(40);
      expect(result.data.state.stats.vitality?.current).toBe(35);
      expect(result.data.state.settings.timeZone).toBe("America/New_York");

      // Verify seasonRank was cleanly initialized
      const rank = result.data.state.seasonRank;
      expect(rank).toBeDefined();
      expect(rank.tier).toBe("recruit");
      expect(rank.division).toBe("III");
      expect(rank.sr).toBe(0);
      expect(rank.isProvisional).toBe(true);
      expect(rank.weeklyMission).toBeDefined();
      expect(rank.weeklyMission.currentCount).toBe(0);
      expect(rank.history).toEqual([]);
    }
  });

  it("upgrades legacy default UTC timezone to browser timezone upon migration", () => {
    const initial = createInitialAppState();
    const v1StateWithoutRank: Record<string, unknown> = { ...initial };
    delete v1StateWithoutRank.seasonRank;

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
    }
  });
});

describe("Storage: StorageManager Migration Write-Back", () => {
  it("persists upgraded v2 envelope back to storage upon loading a v1 envelope", () => {
    const backingStorage = new InMemoryStorageFallback();
    const adapter = new NamespacedLocalStorageAdapter(backingStorage);
    const manager = new StorageManager(adapter);

    // Seed storage with a v1 envelope
    const initial = createInitialAppState();
    const v1StateWithoutRank: Record<string, unknown> = { ...initial };
    delete v1StateWithoutRank.seasonRank;
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
      expect(loadResult.data.seasonRank.tier).toBe("recruit");
      expect(loadResult.data.seasonRank.division).toBe("III");
    }

    // Check underlying storage: should now contain a version 2 envelope
    const rawStored = adapter.getItem(STATE_KEY);
    expect(rawStored.ok).toBe(true);
    if (rawStored.ok && rawStored.data) {
      const persisted = JSON.parse(rawStored.data);
      expect(persisted.version).toBe(2);
      expect(persisted.state.progression.totalXp).toBe(999);
      expect(persisted.state.seasonRank).toBeDefined();
      expect(persisted.state.seasonRank.isProvisional).toBe(true);
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
