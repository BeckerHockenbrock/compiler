/**
 * Migration Engine & Version Transition Registry
 *
 * Current schema version is 3.
 * Migration step files are registered when an actual version transition (e.g. 1 -> 2)
 * is created. This file coordinates the sequential execution of those transitions in memory.
 */

import { type Result, ok, err } from "@/lib/result";
import type { AppState } from "@/domain/types";
import {
  CURRENT_SCHEMA_VERSION,
  StorageEnvelopeSchema,
} from "@/storage/schema";
import type { StorageEnvelope, StorageError } from "@/storage/types";
import { migrateV1ToV2 } from "./v1-to-v2";
import { migrateV2ToV3 } from "./v2-to-v3";

export type MigrationStep = (
  previousState: unknown
) => unknown;

/**
 * Registry of version migrations: maps version V -> function that upgrades from V to V+1.
 */
const migrationRegistry: Map<number, MigrationStep> = new Map();

/**
 * Allows registering a migration transition function (e.g. 1 -> 2).
 */
export function registerMigration(
  fromVersion: number,
  step: MigrationStep
): void {
  migrationRegistry.set(fromVersion, step);
}

// Built-in migrations
registerMigration(1, migrateV1ToV2);
registerMigration(2, migrateV2ToV3);

/**
 * Runs sequential migrations in memory if the payload is from an older schema version.
 */
export function runMigrationsInMemory(
  rawEnvelope: unknown
): Result<StorageEnvelope<AppState>, StorageError> {
  if (typeof rawEnvelope !== "object" || rawEnvelope === null) {
    return err({
      code: "CORRUPT_DATA",
      message: "Envelope must be a non-null object",
      rawPayload: String(rawEnvelope),
    });
  }

  const envelopeObj = rawEnvelope as Record<string, unknown>;
  const version = Number(envelopeObj.version);

  if (!Number.isInteger(version) || version < 0) {
    return err({
      code: "CORRUPT_DATA",
      message: `Invalid or missing envelope version: ${String(envelopeObj.version)}`,
      rawPayload: JSON.stringify(rawEnvelope),
    });
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    return err({
      code: "INVALID_BACKUP",
      message: `Payload version (${version}) is newer than supported app version (${CURRENT_SCHEMA_VERSION}). Please update the app.`,
    });
  }

  let currentVersion = version;
  let currentState: unknown = envelopeObj.state;

  // Run sequential migrations until current schema version is reached
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migrator = migrationRegistry.get(currentVersion);
    if (!migrator) {
      return err({
        code: "INVALID_BACKUP",
        message: `Missing migration step from version ${currentVersion} to ${currentVersion + 1}`,
      });
    }

    try {
      currentState = migrator(currentState);
      currentVersion += 1;
    } catch (migrationError) {
      return err({
        code: "CORRUPT_DATA",
        message: `Migration failed at version ${currentVersion}: ${String(migrationError)}`,
        details: migrationError,
      });
    }
  }

  const targetEnvelope = {
    version: CURRENT_SCHEMA_VERSION,
    updatedAt:
      typeof envelopeObj.updatedAt === "string"
        ? envelopeObj.updatedAt
        : new Date().toISOString(),
    state: currentState,
  };

  const validationResult = StorageEnvelopeSchema.safeParse(targetEnvelope);
  if (!validationResult.success) {
    return err({
      code: "CORRUPT_DATA",
      message: "Migrated state failed schema validation",
      details: validationResult.error.format(),
    });
  }

  return ok(validationResult.data as StorageEnvelope<AppState>);
}
