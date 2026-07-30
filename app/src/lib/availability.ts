import { getBusyIntervals, type BusyInterval } from "./calendar";
import { listBookingsBetween } from "./db";
import { dateRange, minutesToMs, zonedDateString, zonedParts, zonedTimeToUtc } from "./time";
import type { DayAvailability, Service, Slot, Tenant } from "./types";

/**
 * Slot search.
 *
 * A candidate start time is offered when all of these hold:
 *   - it sits inside one of the day's working windows, and the whole
 *     appointment finishes before that window closes;
 *   - the appointment plus its buffer does not overlap anything busy on the
 *     owner's Google Calendar;
 *   - it does not overlap a confirmed booking we already hold in Firestore
 *     (belt and braces — normally the calendar already reflects these);
 *   - it is at least `minNoticeHours` in the future.
 */

/**
 * Firestore can only range-query on `startsAt`, so a booking that began before
 * the window but runs into it would be invisible to a naive query. Widening the
 * lower bound by the longest bookable service (the 8-hour cap enforced when a
 * service is created) guarantees any overlapping booking is fetched.
 */
const MAX_SERVICE_DURATION_MS = 8 * 60 * 60_000;

export interface AvailabilityQuery {
  tenant: Tenant;
  service: Service;
  /** "YYYY-MM-DD" in the business timezone. */
  from: string;
  to: string;
  now?: Date;
}

export async function findAvailability(query: AvailabilityQuery): Promise<DayAvailability[]> {
  const { tenant, service } = query;
  const now = query.now ?? new Date();
  const tz = tenant.timezone;

  const today = zonedDateString(now, tz);
  const lastBookableDay = addDaysToDateString(today, tenant.bookingWindowDays);

  const from = maxDate(query.from, today);
  const to = minDate(query.to, lastBookableDay);
  if (from > to) return [];

  const days = dateRange(from, to);

  // One free/busy call covers the whole window rather than one per day.
  const windowStart = zonedTimeToUtc(from, "00:00", tz);
  const windowEnd = zonedTimeToUtc(addDaysToDateString(to, 1), "00:00", tz);

  const [busy, bookings] = await Promise.all([
    getBusyIntervals(tenant.calendarId, windowStart, windowEnd),
    listBookingsBetween(
      new Date(windowStart.getTime() - MAX_SERVICE_DURATION_MS).toISOString(),
      windowEnd.toISOString(),
    ),
  ]);

  const blocked: BusyInterval[] = [
    ...busy,
    ...bookings.map((b) => ({
      start: new Date(b.startsAt).getTime(),
      end: new Date(b.endsAt).getTime(),
    })),
  ];

  const durationMs = minutesToMs(service.durationMinutes);
  const bufferMs = minutesToMs(tenant.bufferMinutes);
  const stepMs = minutesToMs(Math.max(5, tenant.slotGranularityMinutes));
  const earliestStart = now.getTime() + minutesToMs(tenant.minNoticeHours * 60);

  const results: DayAvailability[] = [];

  for (const date of days) {
    const weekday = zonedParts(zonedTimeToUtc(date, "12:00", tz), tz).weekday;
    const windows = tenant.workingHours[weekday] ?? [];
    const slots: Slot[] = [];

    for (const window of windows) {
      const openMs = zonedTimeToUtc(date, window.start, tz).getTime();
      const closeMs = zonedTimeToUtc(date, window.end, tz).getTime();
      if (closeMs <= openMs) continue;

      // Align the first candidate to the granularity grid relative to opening.
      for (let start = openMs; start + durationMs <= closeMs; start += stepMs) {
        const end = start + durationMs;
        if (start < earliestStart) continue;
        if (overlapsAny(start - bufferMs, end + bufferMs, blocked)) continue;

        slots.push({
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          label: zonedParts(new Date(start), tz).time,
        });
      }
    }

    if (slots.length > 0) {
      slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      results.push({ date, slots });
    }
  }

  return results;
}

/**
 * Re-check a single slot immediately before writing a booking. Availability
 * shown in the browser can be seconds or minutes stale, so this is what
 * actually guards against double-booking.
 */
export async function isSlotStillFree(
  tenant: Tenant,
  service: Service,
  startsAt: Date,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const tz = tenant.timezone;
  const durationMs = minutesToMs(service.durationMinutes);
  const bufferMs = minutesToMs(tenant.bufferMinutes);
  const start = startsAt.getTime();
  const end = start + durationMs;

  if (Number.isNaN(start)) {
    return { ok: false, reason: "That start time is not a valid date." };
  }
  if (start < now.getTime() + minutesToMs(tenant.minNoticeHours * 60)) {
    return {
      ok: false,
      reason: `Bookings need at least ${tenant.minNoticeHours} hours' notice.`,
    };
  }

  const lastBookable = zonedTimeToUtc(
    addDaysToDateString(zonedDateString(now, tz), tenant.bookingWindowDays + 1),
    "00:00",
    tz,
  );
  if (start >= lastBookable.getTime()) {
    return {
      ok: false,
      reason: `Bookings can only be made up to ${tenant.bookingWindowDays} days ahead.`,
    };
  }

  // The slot must sit inside a working window for that day.
  const date = zonedDateString(startsAt, tz);
  const weekday = zonedParts(startsAt, tz).weekday;
  const windows = tenant.workingHours[weekday] ?? [];
  const insideWorkingHours = windows.some((w) => {
    const open = zonedTimeToUtc(date, w.start, tz).getTime();
    const close = zonedTimeToUtc(date, w.end, tz).getTime();
    return start >= open && end <= close;
  });
  if (!insideWorkingHours) {
    return { ok: false, reason: "That time is outside our opening hours." };
  }

  const [busy, bookings] = await Promise.all([
    getBusyIntervals(tenant.calendarId, new Date(start - bufferMs), new Date(end + bufferMs)),
    listBookingsBetween(
      new Date(start - bufferMs - MAX_SERVICE_DURATION_MS).toISOString(),
      new Date(end + bufferMs).toISOString(),
    ),
  ]);

  const blocked: BusyInterval[] = [
    ...busy,
    ...bookings.map((b) => ({
      start: new Date(b.startsAt).getTime(),
      end: new Date(b.endsAt).getTime(),
    })),
  ];

  if (overlapsAny(start - bufferMs, end + bufferMs, blocked)) {
    return { ok: false, reason: "That slot has just been taken. Please pick another time." };
  }

  return { ok: true };
}

function overlapsAny(start: number, end: number, intervals: BusyInterval[]): boolean {
  return intervals.some((i) => i.start < end && i.end > start);
}

function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}
