import { describe, it, expect } from "vitest";
import {
  NamespacedLocalStorageAdapter,
  InMemoryStorageFallback,
} from "@/storage/adapter";
import { StorageManager } from "@/storage/storage-manager";
import { STATE_KEY } from "@/storage/types";

class MockStorage {
  private store = new Map<string, string>();
  public clearCalled = false;
  public throwOnSet = false;
  public throwSecurityError = false;

  getItem(key: string): string | null {
    if (this.throwSecurityError) {
      const err = new Error("The operation is insecure.");
      err.name = "SecurityError";
      throw err;
    }
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwSecurityError) {
      const err = new Error("The operation is insecure.");
      err.name = "SecurityError";
      throw err;
    }
    if (this.throwOnSet) {
      const err = new Error("Quota exceeded");
      err.name = "QuotaExceededError";
      throw err;
    }
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwSecurityError) {
      const err = new Error("The operation is insecure.");
      err.name = "SecurityError";
      throw err;
    }
    this.store.delete(key);
  }

  key(index: number): string | null {
    if (this.throwSecurityError) {
      const err = new Error("The operation is insecure.");
      err.name = "SecurityError";
      throw err;
    }
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    if (this.throwSecurityError) {
      const err = new Error("The operation is insecure.");
      err.name = "SecurityError";
      throw err;
    }
    return this.store.size;
  }

  clear(): void {
    this.clearCalled = true;
    this.store.clear();
  }
}

describe("Storage: NamespacedLocalStorageAdapter", () => {
  it("allows operations on namespaced keys and rejects foreign keys", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);

    const validKey = "personal_app:state";
    const invalidKey = "other_app:settings";

    // Rejects setting invalid key
    const setInvalid = adapter.setItem(invalidKey, "test");
    expect(setInvalid.ok).toBe(false);
    if (!setInvalid.ok) {
      expect(setInvalid.error.code).toBe("STORAGE_UNAVAILABLE");
    }

    // Accepts valid namespaced key
    const setValid = adapter.setItem(validKey, '{"ok":true}');
    expect(setValid.ok).toBe(true);

    const getRes = adapter.getItem(validKey);
    expect(getRes.ok).toBe(true);
    if (getRes.ok) {
      expect(getRes.data).toBe('{"ok":true}');
    }
  });

  it("clears ONLY namespaced keys and NEVER calls localStorage.clear()", () => {
    const mock = new MockStorage();
    // Simulate other app data already in storage
    mock.setItem("unrelated_app:theme", "dark");
    mock.setItem("analytics_id", "12345");

    const adapter = new NamespacedLocalStorageAdapter(mock);
    adapter.setItem("personal_app:state", "data_1");
    adapter.setItem("personal_app:backup:pre_import", "data_2");

    // Invoke clearAppKeys
    const clearRes = adapter.clearAppKeys();
    expect(clearRes.ok).toBe(true);

    // Banned call check: mock.clear() must NEVER have been called
    expect(mock.clearCalled).toBe(false);

    // Verify foreign keys are completely untouched
    expect(mock.getItem("unrelated_app:theme")).toBe("dark");
    expect(mock.getItem("analytics_id")).toBe("12345");

    // Verify namespaced keys are gone
    expect(mock.getItem("personal_app:state")).toBeNull();
    expect(mock.getItem("personal_app:backup:pre_import")).toBeNull();
  });

  it("handles QuotaExceededError with structured error code", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);

    mock.throwOnSet = true;
    const res = adapter.setItem("personal_app:state", "large_payload");

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("QUOTA_EXCEEDED");
    }
  });

  it("computes estimated storage metrics correctly", () => {
    const mock = new MockStorage();
    const adapter = new NamespacedLocalStorageAdapter(mock);

    const key = "personal_app:state";
    const val = "hello"; // 18 chars + 5 chars = 23 chars => 46 bytes estimated
    adapter.setItem(key, val);

    const metricsRes = adapter.getEstimatedMetrics();
    expect(metricsRes.ok).toBe(true);
    if (metricsRes.ok) {
      expect(metricsRes.data.keyCount).toBe(1);
      expect(metricsRes.data.estimatedBytesUsed).toBe((key.length + val.length) * 2);
      expect(metricsRes.data.isNearQuotaWarning).toBe(false);
    }
  });

  it("supports explicitly injected InMemoryStorageFallback for unit tests", () => {
    const inMemory = new InMemoryStorageFallback();
    const adapter = new NamespacedLocalStorageAdapter(inMemory);

    const setRes = adapter.setItem("personal_app:state", "test_value");
    expect(setRes.ok).toBe(true);

    const getRes = adapter.getItem("personal_app:state");
    expect(getRes.ok).toBe(true);
    if (getRes.ok) {
      expect(getRes.data).toBe("test_value");
    }
  });

  it("fails safely with STORAGE_UNAVAILABLE in non-browser environment without injected storage", () => {
    // In node environment without window, adapter without args must fail safely
    const adapter = new NamespacedLocalStorageAdapter();
    const getRes = adapter.getItem("personal_app:state");
    expect(getRes.ok).toBe(false);
    if (!getRes.ok) {
      expect(getRes.error.code).toBe("STORAGE_UNAVAILABLE");
    }

    const setRes = adapter.setItem("personal_app:state", "value");
    expect(setRes.ok).toBe(false);
    if (!setRes.ok) {
      expect(setRes.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });

  it("returns STORAGE_UNAVAILABLE when browser localStorage throws SecurityError on access", () => {
    // Simulate window with throwing localStorage getter
    const originalWindow = globalThis.window;
    try {
      const mockWindow = {
        get localStorage() {
          const err = new Error("SecurityError: Access denied");
          err.name = "SecurityError";
          throw err;
        },
      };
      // @ts-expect-error testing window mock
      globalThis.window = mockWindow;

      const adapter = new NamespacedLocalStorageAdapter();
      const res = adapter.getItem("personal_app:state");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("STORAGE_UNAVAILABLE");
        expect(res.error.message).toContain("blocked or threw a security error");
      }
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("returns STORAGE_UNAVAILABLE when storage operations throw dynamic SecurityError", () => {
    const mock = new MockStorage();
    mock.throwSecurityError = true;
    const adapter = new NamespacedLocalStorageAdapter(mock);

    const getRes = adapter.getItem("personal_app:state");
    expect(getRes.ok).toBe(false);
    if (!getRes.ok) {
      expect(getRes.error.code).toBe("STORAGE_UNAVAILABLE");
    }

    const setRes = adapter.setItem("personal_app:state", "value");
    expect(setRes.ok).toBe(false);
    if (!setRes.ok) {
      expect(setRes.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });

  it("ensures unavailable storage does not overwrite, reset, or mask existing user data in StorageManager", () => {
    const mock = new MockStorage();
    // Simulate existing valid user state already in persistent storage
    mock.setItem(
      STATE_KEY,
      JSON.stringify({
        version: 1,
        updatedAt: "2026-09-08T00:00:00.000Z",
        state: { userImportantData: true },
      })
    );

    // Now simulate storage becoming blocked
    mock.throwSecurityError = true;
    const adapter = new NamespacedLocalStorageAdapter(mock);
    const manager = new StorageManager(adapter);

    // Attempting to load state must return STORAGE_UNAVAILABLE and NOT overwrite or reset defaults
    const loadRes = manager.loadState();
    expect(loadRes.ok).toBe(false);
    if (!loadRes.ok) {
      expect(loadRes.error.code).toBe("STORAGE_UNAVAILABLE");
    }

    // Unblock storage to verify data was completely preserved and never overwritten
    mock.throwSecurityError = false;
    expect(mock.getItem(STATE_KEY)).toContain("userImportantData");
  });
});
