/**
 * Namespaced Storage Adapter
 *
 * Safety Contracts:
 * 1. Strictly enforces the `personal_app:` prefix on all keys.
 * 2. NEVER calls localStorage.clear(). Only clears keys matching the prefix.
 * 3. Safely handles QuotaExceededError and returns structured QUOTA_EXCEEDED errors.
 * 4. Byte measurements are strictly treated as estimates (character count * 2 bytes),
 *    not exact browser engine quota numbers.
 * 5. Unavailable browser storage (blocked or SecurityError) fails safely by returning
 *    structured STORAGE_UNAVAILABLE errors rather than silently falling back to in-memory storage.
 * 6. In-memory storage is retained exclusively via explicit dependency injection for testing.
 */

import { type Result, ok, err } from "@/lib/result";
import {
  type StorageAdapter,
  type StorageError,
  type EstimatedStorageMetrics,
  STORAGE_PREFIX,
} from "./types";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

/**
 * In-memory key-value storage implementation.
 * Kept available for explicit injection in unit tests and isolated harnesses.
 */
export class InMemoryStorageFallback implements KeyValueStorage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  get length(): number {
    return this.map.size;
  }
}

export class NamespacedLocalStorageAdapter implements StorageAdapter {
  private readonly storage: KeyValueStorage | null = null;
  private readonly initError: StorageError | null = null;
  private readonly prefix: string;

  constructor(customStorage?: KeyValueStorage, prefix: string = STORAGE_PREFIX) {
    this.prefix = prefix;

    if (customStorage) {
      this.storage = customStorage;
      return;
    }

    if (typeof window === "undefined") {
      this.initError = {
        code: "STORAGE_UNAVAILABLE",
        message: "Browser storage is unavailable in non-browser environments.",
      };
      return;
    }

    try {
      // Accessing window.localStorage can throw a SecurityError (e.g. storage blocked in iframe/private browsing)
      const storage = window.localStorage;
      if (!storage) {
        this.initError = {
          code: "STORAGE_UNAVAILABLE",
          message: "window.localStorage is not available.",
        };
      } else {
        this.storage = storage;
      }
    } catch (e) {
      this.initError = {
        code: "STORAGE_UNAVAILABLE",
        message: "Access to browser storage was blocked or threw a security error.",
        details: e,
      };
    }
  }

  private getActiveStorage(): Result<KeyValueStorage, StorageError> {
    if (this.initError) {
      return err(this.initError);
    }
    if (!this.storage) {
      return err({
        code: "STORAGE_UNAVAILABLE",
        message: "Browser storage backing is not available.",
      });
    }
    return ok(this.storage);
  }

  private assertNamespacedKey(key: string): Result<string, StorageError> {
    if (!key.startsWith(this.prefix)) {
      return err({
        code: "STORAGE_UNAVAILABLE",
        message: `Security violation: Key "${key}" does not start with required namespace prefix "${this.prefix}"`,
      });
    }
    return ok(key);
  }

  getItem(key: string): Result<string | null, StorageError> {
    const storageRes = this.getActiveStorage();
    if (!storageRes.ok) return storageRes;

    const keyCheck = this.assertNamespacedKey(key);
    if (!keyCheck.ok) return keyCheck;

    try {
      const val = storageRes.data.getItem(key);
      return ok(val);
    } catch (e) {
      return err({
        code: "STORAGE_UNAVAILABLE",
        message: `Failed to read key "${key}": ${String(e)}`,
        details: e,
      });
    }
  }

  setItem(key: string, value: string): Result<void, StorageError> {
    const storageRes = this.getActiveStorage();
    if (!storageRes.ok) return storageRes;

    const keyCheck = this.assertNamespacedKey(key);
    if (!keyCheck.ok) return keyCheck;

    try {
      storageRes.data.setItem(key, value);
      return ok(undefined);
    } catch (e: unknown) {
      const isQuota =
        e instanceof Error &&
        (e.name === "QuotaExceededError" ||
          e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          // iOS Safari legacy code
          ("code" in e && (e as { code: unknown }).code === 22));

      if (isQuota) {
        const metricsRes = this.getEstimatedMetrics();
        const estimatedBytes = metricsRes.ok
          ? metricsRes.data.estimatedBytesUsed
          : 0;

        return err({
          code: "QUOTA_EXCEEDED",
          message:
            "Browser storage quota exceeded. Consider exporting a backup and compacting historical logs.",
          details: { estimatedBytes },
        });
      }

      return err({
        code: "STORAGE_UNAVAILABLE",
        message: `Failed to write key "${key}": ${String(e)}`,
        details: e,
      });
    }
  }

  removeItem(key: string): Result<void, StorageError> {
    const storageRes = this.getActiveStorage();
    if (!storageRes.ok) return storageRes;

    const keyCheck = this.assertNamespacedKey(key);
    if (!keyCheck.ok) return keyCheck;

    try {
      storageRes.data.removeItem(key);
      return ok(undefined);
    } catch (e) {
      return err({
        code: "STORAGE_UNAVAILABLE",
        message: `Failed to remove key "${key}": ${String(e)}`,
        details: e,
      });
    }
  }

  listAppKeys(): Result<string[], StorageError> {
    const storageRes = this.getActiveStorage();
    if (!storageRes.ok) return storageRes;

    try {
      const keys: string[] = [];
      const storage = storageRes.data;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      return ok(keys);
    } catch (e) {
      return err({
        code: "STORAGE_UNAVAILABLE",
        message: `Failed to list storage keys: ${String(e)}`,
        details: e,
      });
    }
  }

  /**
   * Safely clears ONLY app-namespaced keys.
   * NEVER calls localStorage.clear().
   */
  clearAppKeys(): Result<void, StorageError> {
    const storageRes = this.getActiveStorage();
    if (!storageRes.ok) return storageRes;

    const keysRes = this.listAppKeys();
    if (!keysRes.ok) return keysRes;

    for (const key of keysRes.data) {
      const removeRes = this.removeItem(key);
      if (!removeRes.ok) return removeRes;
    }
    return ok(undefined);
  }

  /**
   * Calculates estimated byte usage across all app-namespaced keys.
   * NOTE: UTF-16 character count * 2 is an approximation, not an exact browser quota metric.
   */
  getEstimatedMetrics(): Result<EstimatedStorageMetrics, StorageError> {
    const storageRes = this.getActiveStorage();
    if (!storageRes.ok) return storageRes;

    const keysRes = this.listAppKeys();
    if (!keysRes.ok) return keysRes;

    let totalChars = 0;
    for (const key of keysRes.data) {
      const val = storageRes.data.getItem(key) ?? "";
      totalChars += key.length + val.length;
    }

    const estimatedBytesUsed = totalChars * 2;
    // Standard browser quota is ~5MB (5,242,880 bytes). Warning threshold at ~4MB.
    const WARNING_THRESHOLD = 4 * 1024 * 1024;
    const isNearQuotaWarning = estimatedBytesUsed >= WARNING_THRESHOLD;

    const formattedSize =
      estimatedBytesUsed < 1024
        ? `${estimatedBytesUsed} B`
        : estimatedBytesUsed < 1024 * 1024
        ? `${(estimatedBytesUsed / 1024).toFixed(1)} KB`
        : `${(estimatedBytesUsed / (1024 * 1024)).toFixed(2)} MB`;

    return ok({
      estimatedBytesUsed,
      formattedSize,
      keyCount: keysRes.data.length,
      isNearQuotaWarning,
    });
  }
}
