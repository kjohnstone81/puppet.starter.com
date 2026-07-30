import { NextResponse, type NextRequest } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-helpers";
import { updateTenant } from "@/lib/db";
import { WEEKDAYS, type Tenant, type TimeWindow, type WorkingHours } from "@/lib/types";

export const dynamic = "force-dynamic";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const PATCH = withAdmin(async (request: NextRequest) => {
  const body = (await request.json()) as Partial<Tenant>;
  const patch: Partial<Tenant> = {};

  if (body.businessName !== undefined) {
    const name = body.businessName.trim();
    if (!name) return badRequest("The business needs a name.");
    patch.businessName = name.slice(0, 120);
  }

  if (body.timezone !== undefined) {
    if (!isValidTimeZone(body.timezone)) return badRequest("That timezone isn't recognised.");
    patch.timezone = body.timezone;
  }

  if (body.calendarId !== undefined) {
    const calendarId = body.calendarId.trim();
    if (!calendarId) return badRequest("Pick a calendar to book into.");
    patch.calendarId = calendarId;
  }

  if (body.contactEmail !== undefined) patch.contactEmail = body.contactEmail?.trim() || null;
  if (body.contactPhone !== undefined) patch.contactPhone = body.contactPhone?.trim() || null;

  if (body.bufferMinutes !== undefined) {
    patch.bufferMinutes = clamp(Number(body.bufferMinutes), 0, 120);
  }
  if (body.minNoticeHours !== undefined) {
    patch.minNoticeHours = clamp(Number(body.minNoticeHours), 0, 168);
  }
  if (body.bookingWindowDays !== undefined) {
    patch.bookingWindowDays = clamp(Number(body.bookingWindowDays), 1, 365);
  }
  if (body.slotGranularityMinutes !== undefined) {
    patch.slotGranularityMinutes = clamp(Number(body.slotGranularityMinutes), 5, 240);
  }

  if (body.workingHours !== undefined) {
    const validated = validateWorkingHours(body.workingHours);
    if ("error" in validated) return badRequest(validated.error);
    patch.workingHours = validated.value;
  }

  await updateTenant(patch);
  return NextResponse.json({ ok: true, tenant: patch });
});

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validateWorkingHours(
  input: WorkingHours,
): { value: WorkingHours } | { error: string } {
  const result = {} as WorkingHours;

  for (const day of WEEKDAYS) {
    const windows = input[day];
    if (windows === undefined) {
      result[day] = [];
      continue;
    }
    if (!Array.isArray(windows)) return { error: `Opening hours for ${day} are malformed.` };

    const cleaned: TimeWindow[] = [];
    for (const window of windows) {
      if (!TIME_PATTERN.test(window?.start ?? "") || !TIME_PATTERN.test(window?.end ?? "")) {
        return { error: `Opening hours for ${day} must use HH:MM times.` };
      }
      if (window.end <= window.start) {
        return { error: `On ${day}, the closing time must be after the opening time.` };
      }
      cleaned.push({ start: window.start, end: window.end });
    }

    cleaned.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < cleaned.length; i += 1) {
      if (cleaned[i].start < cleaned[i - 1].end) {
        return { error: `Opening hours for ${day} overlap each other.` };
      }
    }

    result[day] = cleaned;
  }

  return { value: result };
}
