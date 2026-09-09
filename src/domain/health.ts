/**
 * Wearable & Health Domain Abstraction
 *
 * Provider-agnostic domain contracts for physiological metrics:
 * recovery, sleep, daily strain, and workouts.
 *
 * Designed to cleanly isolate wearable providers (e.g. WHOOP, Apple Health)
 * from core progression logic without leaking credentials or hardcoding
 * vendor-specific assumptions.
 *
 * Note on scope discipline: This represents an initial high-value slice
 * (recovery, sleep, strain, workouts). Extended data such as profile/body
 * measurements (read:profile) or detailed sleep hypnograms are deferred until
 * specific features require them, preserving the principle of least privilege.
 */

export type HealthConnectionState = "disconnected" | "connecting" | "connected" | "error";

export type HealthProviderId = "whoop" | "apple_health" | "manual";

export interface HealthRecovery {
  /** Recovery score percentage (0-100) */
  readonly recoveryScore: number;
  /** Resting heart rate in beats per minute */
  readonly restingHeartRate: number;
  /** Heart rate variability: root mean square of successive differences (ms) */
  readonly hrvRmssdMilli: number;
  /** Skin temperature in Celsius (optional) */
  readonly skinTempCelsius?: number;
  /** Blood oxygen saturation percentage (optional) */
  readonly spo2Percentage?: number;
  /** ISO 8601 UTC timestamp of the measurement */
  readonly timestamp: string;
}

export interface HealthSleep {
  /** Sleep performance score percentage (0-100) */
  readonly sleepPerformancePercentage: number;
  /** Total sleep time in seconds */
  readonly totalSleepTimeSeconds: number;
  /** Calculated sleep need in seconds (optional) */
  readonly needDurationSeconds?: number;
  /** Respiratory rate during sleep in breaths per minute (optional) */
  readonly respiratoryRate?: number;
  /** Sleep consistency percentage (optional) */
  readonly sleepConsistencyPercentage?: number;
  /** ISO 8601 UTC timestamp of wake/recording */
  readonly timestamp: string;
}

export interface HealthStrain {
  /** Daily cardiovascular and muscular strain score (0.0 - 21.0) */
  readonly dayStrain: number;
  /** Total energy expenditure in kilojoules */
  readonly kilojoules: number;
  /** Average heart rate across the cycle (optional) */
  readonly averageHeartRate?: number;
  /** Peak heart rate across the cycle (optional) */
  readonly maxHeartRate?: number;
  /** ISO 8601 UTC timestamp of cycle record */
  readonly timestamp: string;
}

export interface HealthWorkout {
  readonly id: string;
  readonly sportName: string;
  readonly activityStrain: number;
  readonly durationSeconds: number;
  readonly kilojoules: number;
  readonly startedAt: string;
  readonly endedAt: string;
}

export interface HealthSnapshot {
  readonly provider: HealthProviderId;
  readonly syncedAt: string;
  readonly recovery?: HealthRecovery;
  readonly sleep?: HealthSleep;
  readonly strain?: HealthStrain;
  readonly workouts?: readonly HealthWorkout[];
}

/**
 * Pluggable Health Integration Provider Contract
 *
 * Each integration adapter (WHOOP, Apple Health, or mock) implements this
 * contract. Live network connections require a secure server backend; client-only
 * builds operate exclusively through disconnected or local stubs.
 */
export interface HealthIntegrationProvider {
  readonly providerId: HealthProviderId;
  readonly displayName: string;
  getConnectionState(): HealthConnectionState;
  getLatestSnapshot(): Promise<HealthSnapshot | null>;
}

/**
 * Default disconnected provider stub for client-only / zero-backend execution.
 */
export class DisconnectedHealthProvider implements HealthIntegrationProvider {
  public readonly providerId: HealthProviderId;
  public readonly displayName: string;

  constructor(providerId: HealthProviderId = "whoop", displayName: string = "WHOOP") {
    this.providerId = providerId;
    this.displayName = displayName;
  }

  public getConnectionState(): HealthConnectionState {
    return "disconnected";
  }

  public async getLatestSnapshot(): Promise<HealthSnapshot | null> {
    return null;
  }
}
