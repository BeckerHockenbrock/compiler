/**
 * Date, Time & Timezone Domain Utilities
 *
 * Core Rules:
 * 1. Timestamps (Points in time): Strict ISO 8601 UTC string (YYYY-MM-DDTHH:mm:ss.sssZ).
 *    Used for createdAt, updatedAt, completedAt, event log records, and export metadata.
 * 2. Calendar Dates (Wall-clock dates): ISO 8601 calendar date format (YYYY-MM-DD).
 *    Used for due dates, habit completion tracking, and streak evaluations.
 * 3. Timezone Resolution:
 *    Streaks and calendar boundaries are computed against the user's active timezone.
 */

const UTC_ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns current instant as a strict ISO 8601 UTC string.
 */
export function nowUtc(): string {
  return new Date().toISOString();
}

/**
 * Validates whether a string matches ISO 8601 UTC format.
 */
export function isValidUtcIsoString(value: string): boolean {
  if (!UTC_ISO_REGEX.test(value)) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

/**
 * Validates whether a string matches YYYY-MM-DD format with valid calendar bounds.
 */
export function isValidCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_REGEX.test(value)) return false;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  // Verify leap years and month lengths via Date
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  return (
    dateObj.getUTCFullYear() === year &&
    dateObj.getUTCMonth() === month - 1 &&
    dateObj.getUTCDate() === day
  );
}

/**
 * Converts a UTC timestamp or Date object into a local calendar date string (YYYY-MM-DD)
 * for a specific IANA timezone (or default system timezone).
 */
export function toLocalDate(
  utcInput: string | Date,
  timeZone?: string
): string {
  const date = typeof utcInput === "string" ? new Date(utcInput) : utcInput;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date input: ${String(utcInput)}`);
  }

  const resolvedTimeZone =
    timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  // Use Intl.DateTimeFormat with parts to guarantee YYYY-MM-DD in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  let year = "";
  let month = "";
  let day = "";

  for (const part of parts) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value;
    if (part.type === "day") day = part.value;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Calculates the difference in calendar days between two YYYY-MM-DD dates.
 * Returns (dateB - dateA) in integer days.
 * Example:
 *   calculateCalendarDayDifference("2026-09-01", "2026-09-02") => 1
 *   calculateCalendarDayDifference("2026-09-02", "2026-09-01") => -1
 *   calculateCalendarDayDifference("2026-09-01", "2026-09-01") => 0
 */
export function calculateCalendarDayDifference(
  dateA: string,
  dateB: string
): number {
  if (!isValidCalendarDate(dateA)) {
    throw new Error(`Invalid calendar date A: ${dateA}`);
  }
  if (!isValidCalendarDate(dateB)) {
    throw new Error(`Invalid calendar date B: ${dateB}`);
  }

  const [yA, mA, dA] = dateA.split("-").map((n) => Number.parseInt(n, 10));
  const [yB, mB, dB] = dateB.split("-").map((n) => Number.parseInt(n, 10));

  const utcMsA = Date.UTC(yA, mA - 1, dA);
  const utcMsB = Date.UTC(yB, mB - 1, dB);

  const MS_PER_DAY = 86_400_000;
  return Math.round((utcMsB - utcMsA) / MS_PER_DAY);
}
