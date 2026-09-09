import { describe, it, expect } from "vitest";
import {
  DisconnectedHealthProvider,
  type HealthSnapshot,
  type HealthRecovery,
  type HealthSleep,
  type HealthStrain,
} from "@/domain/health";

describe("Domain: Health & Wearable Integration Boundary", () => {
  it("initializes DisconnectedHealthProvider with disconnected state and null snapshot", async () => {
    const provider = new DisconnectedHealthProvider("whoop", "WHOOP");

    expect(provider.providerId).toBe("whoop");
    expect(provider.displayName).toBe("WHOOP");
    expect(provider.getConnectionState()).toBe("disconnected");

    const snapshot = await provider.getLatestSnapshot();
    expect(snapshot).toBeNull();
  });

  it("validates normalized health snapshot contract structures", () => {
    const recovery: HealthRecovery = {
      recoveryScore: 88,
      restingHeartRate: 52,
      hrvRmssdMilli: 65,
      timestamp: "2026-09-08T07:00:00.000Z",
    };

    const sleep: HealthSleep = {
      sleepPerformancePercentage: 92,
      totalSleepTimeSeconds: 28800,
      timestamp: "2026-09-08T06:30:00.000Z",
    };

    const strain: HealthStrain = {
      dayStrain: 12.4,
      kilojoules: 8500,
      timestamp: "2026-09-08T20:00:00.000Z",
    };

    const snapshot: HealthSnapshot = {
      provider: "whoop",
      syncedAt: "2026-09-08T20:30:00.000Z",
      recovery,
      sleep,
      strain,
      workouts: [
        {
          id: "workout_1",
          sportName: "Running",
          activityStrain: 8.5,
          durationSeconds: 2400,
          kilojoules: 1800,
          startedAt: "2026-09-08T17:00:00.000Z",
          endedAt: "2026-09-08T17:40:00.000Z",
        },
      ],
    };

    expect(snapshot.provider).toBe("whoop");
    expect(snapshot.recovery?.recoveryScore).toBe(88);
    expect(snapshot.sleep?.totalSleepTimeSeconds).toBe(28800);
    expect(snapshot.strain?.dayStrain).toBe(12.4);
    expect(snapshot.workouts?.length).toBe(1);
    expect(snapshot.workouts?.[0].sportName).toBe("Running");
  });
});
