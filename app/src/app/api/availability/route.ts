import { NextResponse, type NextRequest } from "next/server";
import { findAvailability } from "@/lib/availability";
import { CalendarNotConnectedError } from "@/lib/calendar";
import { getService, getTenant } from "@/lib/db";
import { addDays, zonedDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?serviceId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * `from`/`to` are optional; they default to the whole booking window. Dates are
 * interpreted in the business timezone.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const serviceId = params.get("serviceId");

  if (!serviceId) {
    return NextResponse.json({ error: "serviceId is required." }, { status: 400 });
  }

  try {
    const tenant = await getTenant();
    const service = await getService(serviceId);

    if (!service || !service.active) {
      return NextResponse.json({ error: "That service is not bookable." }, { status: 404 });
    }

    const today = zonedDateString(new Date(), tenant.timezone);
    const from = normaliseDate(params.get("from")) ?? today;
    const to = normaliseDate(params.get("to")) ?? addDays(today, tenant.bookingWindowDays);

    const days = await findAvailability({ tenant, service, from, to });

    return NextResponse.json(
      { days, timezone: tenant.timezone },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CalendarNotConnectedError) {
      return NextResponse.json(
        { error: "Online booking isn't available yet — the calendar isn't connected." },
        { status: 503 },
      );
    }
    console.error("GET /api/availability failed", error);
    return NextResponse.json({ error: "Could not load available times." }, { status: 500 });
  }
}

function normaliseDate(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
