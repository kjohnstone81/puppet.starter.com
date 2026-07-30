"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Tenant } from "@/lib/types";

const COMMON_TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
];

interface Props {
  tenant: Tenant;
  calendars: { id: string; summary: string }[];
  calendarError: string | null;
}

export function SettingsEditor({ tenant, calendars, calendarError }: Props) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(tenant.businessName);
  const [timezone, setTimezone] = useState(tenant.timezone);
  const [calendarId, setCalendarId] = useState(tenant.calendarId);
  const [contactEmail, setContactEmail] = useState(tenant.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(tenant.contactPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // If the calendar list failed we still want the current value selectable.
  const calendarOptions =
    calendars.length > 0 ? calendars : [{ id: calendarId, summary: calendarId }];

  const timezoneOptions = COMMON_TIMEZONES.includes(timezone)
    ? COMMON_TIMEZONES
    : [timezone, ...COMMON_TIMEZONES];

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          timezone,
          calendarId,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not save settings.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error ? <div className="notice error">{error}</div> : null}
      {saved ? <div className="notice success">Settings saved.</div> : null}
      {calendarError ? <div className="notice error">{calendarError}</div> : null}

      <section className="card">
        <h2>Business</h2>

        <div className="field">
          <label htmlFor="businessName">Business name</label>
          <input
            id="businessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="contactEmail">Contact email shown to customers</label>
            <input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="contactPhone">Contact phone</label>
            <input
              id="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Calendar</h2>
        <p className="muted">
          Connected as <strong>{tenant.ownerEmail || "not connected"}</strong>.{" "}
          {tenant.calendarConnected
            ? "Free/busy is read from this account and bookings are written back to it."
            : "Sign in again to grant calendar access."}
        </p>

        <div className="field-row">
          <div className="field">
            <label htmlFor="calendarId">Calendar to book into</label>
            <select
              id="calendarId"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
            >
              {calendarOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="timezone">Business timezone</label>
            <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <a className="btn secondary" href="/api/auth/login">
          Reconnect Google
        </a>
      </section>

      <div>
        <button className="btn" type="button" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
