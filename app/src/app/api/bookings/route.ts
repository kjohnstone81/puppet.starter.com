import { NextResponse, type NextRequest } from "next/server";
import { isSlotStillFree } from "@/lib/availability";
import { CalendarNotConnectedError, createCalendarEvent } from "@/lib/calendar";
import { createBooking, getService, getTenant, updateBooking } from "@/lib/db";
import { formatInstant } from "@/lib/time";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

interface BookingRequest {
  serviceId?: string;
  startsAt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  let payload: BookingRequest;
  try {
    payload = (await request.json()) as BookingRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const serviceId = payload.serviceId?.trim();
  const startsAtRaw = payload.startsAt?.trim();
  const customerName = payload.customerName?.trim();
  const customerEmail = payload.customerEmail?.trim().toLowerCase();

  if (!serviceId || !startsAtRaw || !customerName || !customerEmail) {
    return NextResponse.json(
      { error: "Service, start time, name, and email are all required." },
      { status: 400 },
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "That start time is not a valid date." }, { status: 400 });
  }

  try {
    const tenant = await getTenant();
    const service = await getService(serviceId);
    if (!service || !service.active) {
      return NextResponse.json({ error: "That service is not bookable." }, { status: 404 });
    }

    // Re-check against the live calendar. The grid the customer clicked may be
    // minutes old, and this is the only thing standing between two people and
    // the same slot.
    const check = await isSlotStillFree(tenant, service, startsAt);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 409 });
    }

    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    const record: Omit<Booking, "id"> = {
      serviceId: service.id,
      serviceName: service.name,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      customerName,
      customerEmail,
      customerPhone: payload.customerPhone?.trim() || null,
      notes: payload.notes?.trim().slice(0, 1000) || null,
      status: "confirmed",
      calendarEventId: null,
      createdAt: new Date().toISOString(),
      priceCents: service.priceCents,
      currency: service.currency,
    };

    // Persist first so a calendar hiccup can't lose the customer's booking,
    // then attach the event id.
    const booking = await createBooking(record);

    const description = [
      `Service: ${service.name}`,
      `Customer: ${customerName} <${customerEmail}>`,
      record.customerPhone ? `Phone: ${record.customerPhone}` : null,
      record.notes ? `Notes: ${record.notes}` : null,
      `Booked via ${tenant.businessName} online booking (ref ${booking.id})`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const eventId = await createCalendarEvent({
        calendarId: tenant.calendarId,
        summary: `${service.name} — ${customerName}`,
        description,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        timeZone: tenant.timezone,
        attendeeEmail: customerEmail,
        attendeeName: customerName,
      });
      await updateBooking(booking.id, { calendarEventId: eventId });
      booking.calendarEventId = eventId;
    } catch (error) {
      // The booking stands; the owner sees it in the admin portal with a
      // "not on calendar" marker rather than the customer seeing a failure.
      console.error(`Booking ${booking.id} saved but the calendar event failed`, error);
    }

    return NextResponse.json({
      booking,
      humanTime: formatInstant(booking.startsAt, tenant.timezone),
    });
  } catch (error) {
    if (error instanceof CalendarNotConnectedError) {
      return NextResponse.json(
        { error: "Online booking isn't available yet — the calendar isn't connected." },
        { status: 503 },
      );
    }
    console.error("POST /api/bookings failed", error);
    return NextResponse.json({ error: "We couldn't complete that booking." }, { status: 500 });
  }
}
