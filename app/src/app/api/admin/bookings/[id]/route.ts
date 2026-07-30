import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api-helpers";
import { deleteCalendarEvent } from "@/lib/calendar";
import { getBooking, getTenant, updateBooking } from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * Cancels a booking. The record is kept and marked cancelled rather than
 * deleted, so the owner retains a history; the calendar event is withdrawn,
 * which is what notifies the customer.
 */
export const DELETE = withAdmin(async (_request: NextRequest, context: Context) => {
  const { id } = await context.params;

  const booking = await getBooking(id);
  if (!booking) {
    return NextResponse.json({ error: "That booking no longer exists." }, { status: 404 });
  }

  if (booking.calendarEventId) {
    const tenant = await getTenant();
    try {
      await deleteCalendarEvent(tenant.calendarId, booking.calendarEventId);
    } catch (error) {
      console.error(`Could not remove calendar event for booking ${id}`, error);
      return NextResponse.json(
        {
          error:
            "The calendar event couldn't be removed, so the booking was left in place. Try again.",
        },
        { status: 502 },
      );
    }
  }

  await updateBooking(id, { status: "cancelled" });
  return NextResponse.json({ ok: true });
});
