import Link from "next/link";
import { listUpcomingBookings } from "@/lib/db";
import { loadTenant } from "@/lib/tenant-cache";
import { withTimeout } from "@/lib/with-timeout";
import { formatInstant } from "@/lib/time";
import { formatPrice } from "@/components/site-chrome";
import type { Booking } from "@/lib/types";
import { CancelBookingButton } from "./cancel-booking";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const tenant = await loadTenant();

  let bookings: Booking[] = [];
  let loadError: string | null = null;
  try {
    bookings = await withTimeout(listUpcomingBookings(), 8000, "Firestore bookings read");
  } catch (error) {
    console.error("Failed to load bookings", error);
    loadError =
      error instanceof Error ? error.message : "Could not read bookings from Firestore.";
  }

  const confirmed = bookings.filter((b) => b.status === "confirmed");

  return (
    <>
      <h1>Upcoming bookings</h1>

      {!tenant.calendarConnected ? (
        <div className="notice error">
          Google Calendar isn&apos;t connected, so the public site can&apos;t show any times.{" "}
          <a href="/api/auth/login">Reconnect it</a> with the owner account.
        </div>
      ) : null}

      {loadError ? <div className="notice error">{loadError}</div> : null}

      {confirmed.length === 0 && !loadError ? (
        <div className="notice">
          Nothing booked yet. Share your booking page: <Link href="/">the public site</Link>.
        </div>
      ) : null}

      {confirmed.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Service</th>
                <th>Customer</th>
                <th>Price</th>
                <th>Calendar</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {confirmed.map((booking) => (
                <tr key={booking.id}>
                  <td>{formatInstant(booking.startsAt, tenant.timezone)}</td>
                  <td>{booking.serviceName}</td>
                  <td>
                    {booking.customerName}
                    <br />
                    <span className="muted">{booking.customerEmail}</span>
                    {booking.customerPhone ? (
                      <>
                        <br />
                        <span className="muted">{booking.customerPhone}</span>
                      </>
                    ) : null}
                    {booking.notes ? (
                      <>
                        <br />
                        <span className="muted">“{booking.notes}”</span>
                      </>
                    ) : null}
                  </td>
                  <td>{formatPrice(booking.priceCents, booking.currency)}</td>
                  <td>
                    {booking.calendarEventId ? (
                      <span className="pill">Synced</span>
                    ) : (
                      <span className="pill" title="Saved here, but not written to Google Calendar">
                        Not synced
                      </span>
                    )}
                  </td>
                  <td>
                    <CancelBookingButton bookingId={booking.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
