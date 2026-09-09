import { describe, it, expect } from "vitest";
import { exportBackup, importBackup } from "@/storage/backup";
import { NamespacedLocalStorageAdapter } from "@/storage/adapter";
import { createInitialAppState } from "@/domain/defaults";
import { STATE_KEY, PRE_IMPORT_BACKUP_KEY } from "@/storage/types";

class MockStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

describe("Storage: Backup Export & Import", () => {
  it("exports valid JSON with accidental-corruption checksum and envelope", () => {
    const state = createInitialAppState();
    const backupJson = exportBackup(state);

    const parsed = JSON.parse(backupJson);
    expect(parsed.app).toBe("personal_progression_app");
    expect(parsed.formatVersion).toBe(1);
    expect(typeof parsed.checksum).toBe("string");
    expect(parsed.envelope.state.progression.level).toBe(1);
  });

  it("requires explicit confirmation before importing", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);
    const state = createInitialAppState();
    const backupJson = exportBackup(state);

    const result = importBackup(adapter, backupJson, { confirmOverwrite: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFIRMATION_REQUIRED");
    }
  });

  it("detects accidental corruption or truncation via checksum verification", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);
    const state = createInitialAppState();
    const backupJson = exportBackup(state);

    const parsed = JSON.parse(backupJson);
    // Tamper with envelope without updating checksum
    parsed.envelope.state.progression.totalXp = 999999;
    const tamperedJson = JSON.stringify(parsed);

    const result = importBackup(adapter, tamperedJson, { confirmOverwrite: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CHECKSUM_MISMATCH");
    }
  });

  it("creates a pre-import safety backup snapshot before atomically replacing active state", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);

    // Existing active state
    const priorPayload = JSON.stringify({
      version: 1,
      updatedAt: "2026-09-01T00:00:00.000Z",
      state: { ...createInitialAppState(), progression: { totalXp: 50, level: 1, availableSkillPoints: 0, lifetimeCompletedTasks: 1, lifetimeHabitCompletions: 0 } },
    });
    adapter.setItem(STATE_KEY, priorPayload);

    // New state to import
    const newState = {
      ...createInitialAppState(),
      progression: { totalXp: 500, level: 3, availableSkillPoints: 2, lifetimeCompletedTasks: 5, lifetimeHabitCompletions: 3 },
    };
    const backupJson = exportBackup(newState);

    const importResult = importBackup(adapter, backupJson, { confirmOverwrite: true });
    expect(importResult.ok).toBe(true);

    // Verify pre-import backup snapshot was created with prior state
    const snapshotRaw = adapter.getItem(PRE_IMPORT_BACKUP_KEY);
    expect(snapshotRaw.ok).toBe(true);
    if (snapshotRaw.ok) {
      expect(snapshotRaw.data).toBe(priorPayload);
    }

    // Verify active key was replaced with new state
    const activeStateRaw = adapter.getItem(STATE_KEY);
    expect(activeStateRaw.ok).toBe(true);
    if (activeStateRaw.ok && activeStateRaw.data) {
      const parsedActive = JSON.parse(activeStateRaw.data);
      expect(parsedActive.state.progression.totalXp).toBe(500);
      expect(parsedActive.state.progression.level).toBe(3);
    }
  });
});
