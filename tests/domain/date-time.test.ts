import { describe, it, expect } from "vitest";
import {
  nowUtc,
  isValidUtcIsoString,
  isValidCalendarDate,
  toLocalDate,
  calculateCalendarDayDifference,
} from "@/domain/date-time";

describe("Domain: Date, Time & Timezone Rules", () => {
  describe("nowUtc & isValidUtcIsoString", () => {
    it("generates and validates strict ISO 8601 UTC string", () => {
      const stamp = nowUtc();
      expect(isValidUtcIsoString(stamp)).toBe(true);
      expect(stamp.endsWith("Z")).toBe(true);
    });

    it("rejects non-UTC and malformed timestamps", () => {
      expect(isValidUtcIsoString("2026-09-08")).toBe(false);
      expect(isValidUtcIsoString("2026-09-08T18:00:00+02:00")).toBe(false);
      expect(isValidUtcIsoString("invalid")).toBe(false);
    });
  });

  describe("isValidCalendarDate", () => {
    it("accepts valid YYYY-MM-DD dates", () => {
      expect(isValidCalendarDate("2026-09-08")).toBe(true);
      expect(isValidCalendarDate("2024-02-29")).toBe(true); // Leap year
    });

    it("rejects invalid dates and format violations", () => {
      expect(isValidCalendarDate("2023-02-29")).toBe(false); // Non-leap year
      expect(isValidCalendarDate("2026-13-01")).toBe(false);
      expect(isValidCalendarDate("2026-09-32")).toBe(false);
      expect(isValidCalendarDate("09-08-2026")).toBe(false);
    });
  });

  describe("toLocalDate", () => {
    it("converts UTC timestamp to expected calendar date across timezones", () => {
      // 2026-01-01 at 02:00 UTC
      const utcTime = "2026-01-01T02:00:00.000Z";

      // In UTC, this is 2026-01-01
      expect(toLocalDate(utcTime, "UTC")).toBe("2026-01-01");

      // In New York (UTC-5), this is 2025-12-31 at 21:00
      expect(toLocalDate(utcTime, "America/New_York")).toBe("2025-12-31");

      // In Tokyo (UTC+9), this is 2026-01-01 at 11:00
      expect(toLocalDate(utcTime, "Asia/Tokyo")).toBe("2026-01-01");
    });
  });

  describe("calculateCalendarDayDifference", () => {
    it("calculates exact calendar day differences", () => {
      expect(calculateCalendarDayDifference("2026-09-01", "2026-09-02")).toBe(1);
      expect(calculateCalendarDayDifference("2026-09-02", "2026-09-01")).toBe(-1);
      expect(calculateCalendarDayDifference("2026-09-01", "2026-09-01")).toBe(0);
      expect(calculateCalendarDayDifference("2025-12-31", "2026-01-01")).toBe(1);
    });

    it("throws on invalid dates", () => {
      expect(() =>
        calculateCalendarDayDifference("bad-date", "2026-09-01")
      ).toThrow();
    });
  });
});
