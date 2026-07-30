import { WEEKDAYS, type Weekday } from "./types";

/**
 * Timezone helpers built on Intl, so the app carries no date library.
 *
 * Everything persisted (Firestore, Google Calendar) is a UTC instant. The
 * business timezone is only used to decide which wall-clock windows are
 * bookable and to render times to humans.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(timeZone, fmt);
  }
  return fmt;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  time: string;
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  // Intl renders midnight as "24" in some ICU versions; normalise to 0.
  const hour = Number(map.hour) % 24;
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const minute = Number(map.minute);
  const second = Number(map.second);

  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday);

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: WEEKDAYS[weekdayIndex >= 0 ? weekdayIndex : 0],
    date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
  };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` to the UTC instant it refers to.
 *
 * The two-pass refinement handles DST transitions: the first pass uses the
 * offset at the naive guess, the second re-reads the offset at the corrected
 * instant. For times that fall in a spring-forward gap this settles on the
 * instant immediately after the jump, which is the behaviour we want for
 * availability windows.
 */
export function zonedTimeToUtc(
  date: string, // "YYYY-MM-DD"
  time: string, // "HH:MM"
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  let instant = naive - offsetMs(new Date(naive), timeZone);
  instant = naive - offsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** "YYYY-MM-DD" for the calendar day `instant` falls on in `timeZone`. */
export function zonedDateString(instant: Date, timeZone: string): string {
  return zonedParts(instant, timeZone).date;
}

/** Add whole days to a "YYYY-MM-DD" string without touching timezones. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Inclusive list of "YYYY-MM-DD" strings from `from` to `to`. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  // Guard against a pathological range blowing up the response.
  for (let i = 0; i < 400 && cursor <= to; i += 1) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function minutesToMs(minutes: number): number {
  return minutes * 60_000;
}

/** Human-readable date, e.g. "Thu 14 Aug". */
export function formatDateLabel(date: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Human-readable instant in the business timezone, e.g. "Thu 14 Aug, 14:30". */
export function formatInstant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
