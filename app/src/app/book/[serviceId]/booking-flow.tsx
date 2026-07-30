"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DayAvailability, Slot } from "@/lib/types";

interface Props {
  serviceId: string;
  serviceName: string;
  timezone: string;
  bookButtonLabel: string;
}

interface Confirmation {
  bookingId: string;
  startsAt: string;
  customerEmail: string;
}

export function BookingFlow({ serviceId, serviceName, timezone, bookButtonLabel }: Props) {
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/availability?serviceId=${encodeURIComponent(serviceId)}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not load available times.");
      setDays(body.days as DayAvailability[]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load available times.");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          startsAt: selected.startsAt,
          customerName: form.get("customerName"),
          customerEmail: form.get("customerEmail"),
          customerPhone: form.get("customerPhone"),
          notes: form.get("notes"),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "We couldn't complete that booking.");

      setConfirmation({
        bookingId: body.booking.id,
        startsAt: body.booking.startsAt,
        customerEmail: body.booking.customerEmail,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We couldn't complete that booking.");
      // The slot may have gone in the meantime — refresh so the grid is honest.
      void loadAvailability();
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <section className="card" style={{ marginTop: "2rem" }}>
        <h2>You&apos;re booked in</h2>
        <p>
          {serviceName} on{" "}
          <strong>{formatInBrowser(confirmation.startsAt, timezone)}</strong>.
        </p>
        <p className="muted">
          A calendar invitation is on its way to {confirmation.customerEmail}. Your reference is{" "}
          <code>{confirmation.bookingId}</code>.
        </p>
        <Link className="btn" href="/">
          Back to services
        </Link>
      </section>
    );
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>Choose a time</h2>

      {loading ? <p className="muted">Checking the calendar…</p> : null}
      {loadError ? <div className="notice error">{loadError}</div> : null}
      {!loading && !loadError && days.length === 0 ? (
        <div className="notice">
          There are no free slots in the current booking window. Please check back later.
        </div>
      ) : null}

      {days.map((day) => (
        <div key={day.date} className="day-block">
          <h3>{formatDayHeading(day.date, timezone)}</h3>
          <div className="slot-grid">
            {day.slots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                className="slot"
                aria-pressed={selected?.startsAt === slot.startsAt}
                onClick={() => setSelected(slot)}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected ? (
        <form className="card" onSubmit={submit} style={{ marginTop: "1rem" }}>
          <h2>Your details</h2>
          <p className="muted">
            Booking {serviceName} at {formatInBrowser(selected.startsAt, timezone)}.
          </p>

          {submitError ? <div className="notice error">{submitError}</div> : null}

          <div className="field-row">
            <div className="field">
              <label htmlFor="customerName">Full name</label>
              <input id="customerName" name="customerName" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="customerEmail">Email</label>
              <input
                id="customerEmail"
                name="customerEmail"
                type="email"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="customerPhone">Phone (optional)</label>
            <input id="customerPhone" name="customerPhone" type="tel" autoComplete="tel" />
          </div>

          <div className="field">
            <label htmlFor="notes">Anything we should know? (optional)</label>
            <textarea id="notes" name="notes" rows={3} maxLength={1000} />
          </div>

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Confirming…" : bookButtonLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function formatDayHeading(date: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function formatInBrowser(iso: string, timeZone: string): string {
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
