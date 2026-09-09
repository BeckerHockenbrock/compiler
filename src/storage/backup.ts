/**
 * Backup Export & Import Pipeline
 *
 * Safety Contracts:
 * 1. Validates schema and executes any migrations entirely in memory before touching storage.
 * 2. Requires explicit user confirmation (confirmOverwrite: true).
 * 3. Creates a pre-import safety backup (personal_app:backup:pre_import) before overwriting.
 * 4. Atomically replaces active personal_app:state only after all checks pass.
 * 5. Checksum is used exclusively to catch accidental file truncation or copy corruption.
 */

import { type Result, ok, err } from "@/lib/result";
import type { AppState } from "@/domain/types";
import { nowUtc } from "@/domain/date-time";
import { calculateChecksum, verifyChecksum } from "./checksum";
import { runMigrationsInMemory } from "./migrations";
import {
  type StorageAdapter,
  type StorageError,
  type StorageEnvelope,
  type BackupEnvelope,
  STATE_KEY,
  PRE_IMPORT_BACKUP_KEY,
} from "./types";
import { CURRENT_SCHEMA_VERSION } from "./schema";

export interface ImportOptions {
  /** Explicit confirmation required from the user before active state is overwritten */
  readonly confirmOverwrite: boolean;
}

/**
 * Generates a validated JSON backup string from current active state or given state.
 */
export function exportBackup(
  currentState: AppState
): string {
  const envelope: StorageEnvelope<AppState> = {
    version: CURRENT_SCHEMA_VERSION,
    updatedAt: nowUtc(),
    state: currentState,
  };

  const serializedEnvelope = JSON.stringify(envelope);
  const checksum = calculateChecksum(serializedEnvelope);

  const backup: BackupEnvelope = {
    app: "personal_progression_app",
    formatVersion: 1,
    exportedAt: nowUtc(),
    checksum,
    envelope,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Validates, migrates, snapshots, and replaces active application state from a backup string.
 */
export function importBackup(
  adapter: StorageAdapter,
  rawJsonString: string,
  options: ImportOptions
): Result<AppState, StorageError> {
  // Step 1: User confirmation check
  if (!options.confirmOverwrite) {
    return err({
      code: "CONFIRMATION_REQUIRED",
      message:
        "Backup restoration will replace current app state. Explicit confirmation required.",
    });
  }

  // Step 2: In-memory JSON parse
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawJsonString);
  } catch (parseError) {
    return err({
      code: "INVALID_BACKUP",
      message: "Backup data is not valid JSON.",
      details: parseError,
    });
  }

  if (typeof parsedRaw !== "object" || parsedRaw === null) {
    return err({
      code: "INVALID_BACKUP",
      message: "Backup payload must be a JSON object.",
    });
  }

  const backupObj = parsedRaw as Record<string, unknown>;

  // Check app signature
  if (backupObj.app !== "personal_progression_app") {
    return err({
      code: "INVALID_BACKUP",
      message:
        'Invalid backup file: missing or invalid "app" signature (expected "personal_progression_app").',
    });
  }

  if (!backupObj.envelope || typeof backupObj.envelope !== "object") {
    return err({
      code: "INVALID_BACKUP",
      message: 'Invalid backup file: missing "envelope" object.',
    });
  }

  // Step 3: Accidental-corruption checksum verification
  const expectedChecksum = String(backupObj.checksum ?? "");
  const serializedEnvelope = JSON.stringify(backupObj.envelope);
  if (!verifyChecksum(serializedEnvelope, expectedChecksum)) {
    return err({
      code: "CHECKSUM_MISMATCH",
      message:
        "Backup checksum mismatch. The file may be truncated or corrupted from copy-pasting.",
      details: {
        expected: expectedChecksum,
        actual: calculateChecksum(serializedEnvelope),
      },
    });
  }

  // Step 4: In-memory migration & schema validation
  const migrationRes = runMigrationsInMemory(backupObj.envelope);
  if (!migrationRes.ok) {
    return migrationRes;
  }
  const migratedEnvelope = migrationRes.data;

  // Step 5: Create pre-import backup snapshot
  const currentStateRaw = adapter.getItem(STATE_KEY);
  if (currentStateRaw.ok && currentStateRaw.data !== null) {
    const preImportWrite = adapter.setItem(
      PRE_IMPORT_BACKUP_KEY,
      currentStateRaw.data
    );
    if (!preImportWrite.ok) {
      return preImportWrite;
    }
  }

  // Step 6: Atomic write of the new active state
  const writeRes = adapter.setItem(
    STATE_KEY,
    JSON.stringify(migratedEnvelope)
  );
  if (!writeRes.ok) {
    return writeRes;
  }

  return ok(migratedEnvelope.state);
}
