/**
 * Storage Abstraction & Error Types
 */

import type { Result } from "@/lib/result";
import type { AppState } from "@/domain/types";

export const STORAGE_PREFIX = "personal_app:" as const;
export const STATE_KEY = "personal_app:state" as const;
export const PRE_IMPORT_BACKUP_KEY = "personal_app:backup:pre_import" as const;

export interface StorageEnvelope<T> {
  readonly version: number;
  /** ISO 8601 UTC timestamp */
  readonly updatedAt: string;
  readonly state: T;
}

export type StorageErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "CORRUPT_DATA"
  | "INVALID_BACKUP"
  | "CHECKSUM_MISMATCH"
  | "CONFIRMATION_REQUIRED";

export interface StorageError {
  readonly code: StorageErrorCode;
  readonly message: string;
  readonly rawPayload?: string | null;
  readonly details?: unknown;
}

export interface EstimatedStorageMetrics {
  /** Estimated bytes (UTF-16 char count * 2) across namespaced keys */
  readonly estimatedBytesUsed: number;
  readonly formattedSize: string;
  readonly keyCount: number;
  readonly isNearQuotaWarning: boolean;
}

export interface StorageAdapter {
  getItem(key: string): Result<string | null, StorageError>;
  setItem(key: string, value: string): Result<void, StorageError>;
  removeItem(key: string): Result<void, StorageError>;
  listAppKeys(): Result<string[], StorageError>;
  /** Safely removes only keys starting with personal_app: prefix. NEVER calls localStorage.clear() */
  clearAppKeys(): Result<void, StorageError>;
  getEstimatedMetrics(): Result<EstimatedStorageMetrics, StorageError>;
}

export interface BackupEnvelope {
  readonly app: "personal_progression_app";
  readonly formatVersion: 1;
  readonly exportedAt: string;
  /** FNV-1a checksum of the stringified envelope for accidental-corruption detection */
  readonly checksum: string;
  readonly envelope: StorageEnvelope<AppState>;
}
