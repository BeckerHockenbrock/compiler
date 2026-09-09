/**
 * Storage Manager
 *
 * Central coordinator for local persistence, non-destructive corrupt state handling,
 * estimated metrics, and explicit reset/raw-export flows.
 */

import { type Result, ok, err } from "@/lib/result";
import type { AppState } from "@/domain/types";
import { createInitialAppState } from "@/domain/defaults";
import { nowUtc } from "@/domain/date-time";
import {
  type StorageAdapter,
  type StorageError,
  type StorageEnvelope,
  type EstimatedStorageMetrics,
  STATE_KEY,
} from "./types";
import { CURRENT_SCHEMA_VERSION, StorageEnvelopeSchema } from "./schema";
import { runMigrationsInMemory } from "./migrations";

export class StorageManager {
  private readonly adapter: StorageAdapter;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }

  /**
   * Loads and validates the application state from personal_app:state.
   *
   * NON-DESTRUCTIVE ERROR HANDLING:
   * If stored data cannot be parsed or fails validation, personal_app:state
   * is preserved completely untouched. A CORRUPT_DATA error is returned
   * containing the raw payload for inspection/export.
   */
  loadState(): Result<AppState, StorageError> {
    const rawResult = this.adapter.getItem(STATE_KEY);
    if (!rawResult.ok) {
      return rawResult;
    }

    const rawString = rawResult.data;

    // First time launch / empty storage: return initial default state
    if (rawString === null) {
      const initialState = createInitialAppState();
      const saveResult = this.saveState(initialState);
      if (!saveResult.ok) {
        return err(saveResult.error);
      }
      return ok(initialState);
    }

    // Attempt JSON parse
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawString);
    } catch (parseError) {
      return err({
        code: "CORRUPT_DATA",
        message: "Stored state contains unparseable JSON.",
        rawPayload: rawString,
        details: parseError,
      });
    }

    // Run in-memory migrations (if stored version < CURRENT_SCHEMA_VERSION)
    const migrationResult = runMigrationsInMemory(parsed);
    if (!migrationResult.ok) {
      return err({
        code: "CORRUPT_DATA",
        message: `Stored state failed validation: ${migrationResult.error.message}`,
        rawPayload: rawString,
        details: migrationResult.error,
      });
    }

    return ok(migrationResult.data.state);
  }

  /**
   * Saves application state into personal_app:state wrapped in an envelope.
   */
  saveState(state: AppState): Result<void, StorageError> {
    const envelope: StorageEnvelope<AppState> = {
      version: CURRENT_SCHEMA_VERSION,
      updatedAt: nowUtc(),
      state,
    };

    const validation = StorageEnvelopeSchema.safeParse(envelope);
    if (!validation.success) {
      return err({
        code: "CORRUPT_DATA",
        message: "Failed to validate state envelope before saving.",
        details: validation.error.format(),
      });
    }

    const serialized = JSON.stringify(envelope);
    return this.adapter.setItem(STATE_KEY, serialized);
  }

  /**
   * Retrieves the raw string currently stored at personal_app:state.
   * Useful for inspecting or exporting corrupt data for manual user rescue.
   */
  getRawState(): Result<string | null, StorageError> {
    return this.adapter.getItem(STATE_KEY);
  }

  /**
   * Explicitly resets storage to initial default state.
   * Requires explicit confirmation so users never accidentally wipe data.
   */
  resetToDefaults(options: { confirmReset: boolean }): Result<AppState, StorageError> {
    if (!options.confirmReset) {
      return err({
        code: "CONFIRMATION_REQUIRED",
        message: "Resetting state requires explicit confirmation.",
      });
    }

    const initialState = createInitialAppState();
    const saveRes = this.saveState(initialState);
    if (!saveRes.ok) {
      return err(saveRes.error);
    }

    return ok(initialState);
  }

  /**
   * Returns estimated storage metrics across namespaced keys.
   */
  getMetrics(): Result<EstimatedStorageMetrics, StorageError> {
    return this.adapter.getEstimatedMetrics();
  }
}
