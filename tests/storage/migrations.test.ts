import { describe, it, expect } from "vitest";
import { runMigrationsInMemory, registerMigration } from "@/storage/migrations";
import { CURRENT_SCHEMA_VERSION } from "@/storage/schema";
import { createInitialAppState } from "@/domain/defaults";

describe("Storage: Migrations Engine", () => {
  it("accepts and validates a current schema version (version 1) envelope", () => {
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
    }
  });
});
