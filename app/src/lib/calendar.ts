import { refreshAccessToken } from "./auth";
import { getGoogleCredentials } from "./db";

/**
 * Thin Google Calendar client over fetch. The full googleapis package is a
 * large dependency for the three calls we actually make, so this talks to the
 * REST API directly.
 */

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export class CalendarNotConnectedError extends Error {
  constructor() {
    super("Google Calendar is not connected. Sign in to the admin portal to connect it.");
    this.name = "CalendarNotConnectedError";
  }
}

/** Access tokens live an hour; cache in-process so a burst of requests reuses one. */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const creds = await getGoogleCredentials();
  if (!creds?.refreshToken) throw new CalendarNotConnectedError();

  const token = await refreshAccessToken(creds.refreshToken);
  cachedToken = { token, expiresAt: Date.now() + 50 * 60_000 };
  return token;
}

/** Drop the cached token — call after an auth failure so the next call refreshes. */
export function invalidateTokenCache(): void {
  cachedToken = null;
}

async function calendarFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    invalidateTokenCache();
  }
  return res;
}

export interface BusyInterval {
  /** UTC instants in ms. */
  start: number;
  end: number;
}

/**
 * Busy intervals on `calendarId` between two instants, from the free/busy API.
 * This is the source of truth for availability: anything on the owner's
 * calendar — including events created outside this app — blocks a slot.
 */
export async function getBusyIntervals(
  calendarId: string,
  from: Date,
  to: Date,
): Promise<BusyInterval[]> {
  const res = await calendarFetch("/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Calendar free/busy lookup failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>;
  };

  const entry = json.calendars?.[calendarId];
  if (entry?.errors?.length) {
    throw new Error(`Calendar free/busy returned errors: ${JSON.stringify(entry.errors)}`);
  }

  return (entry?.busy ?? []).map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));
}

export interface CreateEventInput {
  calendarId: string;
  summary: string;
  description: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  timeZone: string;
  attendeeEmail?: string;
  attendeeName?: string;
}

export async function createCalendarEvent(input: CreateEventInput): Promise<string> {
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startsAt, timeZone: input.timeZone },
    end: { dateTime: input.endsAt, timeZone: input.timeZone },
  };

  if (input.attendeeEmail) {
    body.attendees = [{ email: input.attendeeEmail, displayName: input.attendeeName }];
  }

  const res = await calendarFetch(
    `/calendars/${encodeURIComponent(input.calendarId)}/events?sendUpdates=all`,
    { method: "POST", body: JSON.stringify(body) },
  );

  if (!res.ok) {
    throw new Error(`Creating the calendar event failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  const res = await calendarFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE" },
  );
  // 410 means it was already gone, which is the state we wanted anyway.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Deleting the calendar event failed (${res.status}): ${await res.text()}`);
  }
}

/** Calendars the connected account can write to — used by the settings page. */
export async function listWritableCalendars(): Promise<{ id: string; summary: string }[]> {
  const res = await calendarFetch("/users/me/calendarList?minAccessRole=writer");
  if (!res.ok) {
    throw new Error(`Listing calendars failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as {
    items?: { id: string; summary: string; primary?: boolean }[];
  };
  return (json.items ?? []).map((c) => ({
    id: c.primary ? "primary" : c.id,
    summary: c.primary ? `${c.summary} (primary)` : c.summary,
  }));
}
