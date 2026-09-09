import { describe, it, expect } from "vitest";
import { StorageManager } from "@/storage/storage-manager";
import { NamespacedLocalStorageAdapter } from "@/storage/adapter";
import { STATE_KEY } from "@/storage/types";

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

describe("Storage: Non-Destructive Corrupt State Handling", () => {
  it("preserves corrupt personal_app:state without auto-archiving or deleting", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);
    const manager = new StorageManager(adapter);

    const malformedPayload = '{"version": 1, "state": { truncated...';
    adapter.setItem(STATE_KEY, malformedPayload);

    // Attempt to load
    const loadResult = manager.loadState();
    expect(loadResult.ok).toBe(false);
    if (!loadResult.ok) {
      expect(loadResult.error.code).toBe("CORRUPT_DATA");
      expect(loadResult.error.rawPayload).toBe(malformedPayload);
    }

    // Crucial assertion: original key MUST be preserved intact
    expect(mock.getItem(STATE_KEY)).toBe(malformedPayload);

    // Crucial assertion: NO archive keys were written to storage
    const allKeysRes = adapter.listAppKeys();
    expect(allKeysRes.ok).toBe(true);
    if (allKeysRes.ok) {
      expect(allKeysRes.data).toEqual([STATE_KEY]);
    }

    // Raw state is accessible for manual export/recovery
    const rawRes = manager.getRawState();
    expect(rawRes.ok).toBe(true);
    if (rawRes.ok) {
      expect(rawRes.data).toBe(malformedPayload);
    }
  });

  it("handles schema-invalid JSON non-destructively", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);
    const manager = new StorageManager(adapter);

    const schemaInvalidPayload = JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      state: { invalid: "missing required AppState fields" },
    });
    adapter.setItem(STATE_KEY, schemaInvalidPayload);

    const loadResult = manager.loadState();
    expect(loadResult.ok).toBe(false);
    if (!loadResult.ok) {
      expect(loadResult.error.code).toBe("CORRUPT_DATA");
    }

    // Key remains untouched
    expect(mock.getItem(STATE_KEY)).toBe(schemaInvalidPayload);
  });

  it("requires explicit confirmation before resetting corrupt state to defaults", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);
    const manager = new StorageManager(adapter);

    const malformedPayload = "{ bad json";
    adapter.setItem(STATE_KEY, malformedPayload);

    // Attempt reset without confirmation
    const unconfirmedReset = manager.resetToDefaults({ confirmReset: false });
    expect(unconfirmedReset.ok).toBe(false);
    if (!unconfirmedReset.ok) {
      expect(unconfirmedReset.error.code).toBe("CONFIRMATION_REQUIRED");
    }
    // Key still untouched
    expect(mock.getItem(STATE_KEY)).toBe(malformedPayload);

    // Confirmed reset
    const confirmedReset = manager.resetToDefaults({ confirmReset: true });
    expect(confirmedReset.ok).toBe(true);

    // Subsequent load succeeds with defaults
    const newLoad = manager.loadState();
    expect(newLoad.ok).toBe(true);
    if (newLoad.ok) {
      expect(newLoad.data.progression.level).toBe(1);
    }
  });
});
