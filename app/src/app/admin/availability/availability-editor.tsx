"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WEEKDAYS, type Tenant, type TimeWindow, type Weekday, type WorkingHours } from "@/lib/types";

const DAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// Render Monday-first; WEEKDAYS is Sunday-first because that matches the
// JavaScript weekday index used when resolving a date to a day.
const DISPLAY_ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function AvailabilityEditor({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [hours, setHours] = useState<WorkingHours>(tenant.workingHours);
  const [bufferMinutes, setBufferMinutes] = useState(tenant.bufferMinutes);
  const [minNoticeHours, setMinNoticeHours] = useState(tenant.minNoticeHours);
  const [bookingWindowDays, setBookingWindowDays] = useState(tenant.bookingWindowDays);
  const [slotGranularityMinutes, setSlotGranularity] = useState(tenant.slotGranularityMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateWindow(day: Weekday, index: number, patch: Partial<TimeWindow>) {
    setHours((current) => ({
      ...current,
      [day]: current[day].map((w, i) => (i === index ? { ...w, ...patch } : w)),
    }));
  }

  function addWindow(day: Weekday) {
    setHours((current) => ({
      ...current,
      [day]: [...current[day], { start: "09:00", end: "17:00" }],
    }));
  }

  function removeWindow(day: Weekday, index: number) {
    setHours((current) => ({
      ...current,
      [day]: current[day].filter((_, i) => i !== index),
    }));
  }

  async function save() {
    for (const day of WEEKDAYS) {
      for (const window of hours[day]) {
        if (window.end <= window.start) {
          setError(`${DAY_LABELS[day]}: the closing time must be after the opening time.`);
          return;
        }
      }
    }

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingHours: hours,
          bufferMinutes,
          minNoticeHours,
          bookingWindowDays,
          slotGranularityMinutes,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not save availability.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save availability.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error ? <div className="notice error">{error}</div> : null}
      {saved ? <div className="notice success">Availability saved.</div> : null}

      <section className="card">
        <h2>Opening hours ({tenant.timezone})</h2>
        {DISPLAY_ORDER.map((day) => (
          <div key={day} style={{ marginBottom: "1rem" }}>
            <div className="row-between">
              <strong>{DAY_LABELS[day]}</strong>
              <button
                className="btn secondary small"
                type="button"
                onClick={() => addWindow(day)}
                disabled={busy}
              >
                Add hours
              </button>
            </div>

            {hours[day].length === 0 ? (
              <p className="muted" style={{ margin: "0.25rem 0" }}>
                Closed
              </p>
            ) : (
              hours[day].map((window, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    margin: "0.4rem 0",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="time"
                    value={window.start}
                    onChange={(e) => updateWindow(day, index, { start: e.target.value })}
                    style={{ width: "auto" }}
                    aria-label={`${DAY_LABELS[day]} opening time`}
                  />
                  <span className="muted">to</span>
                  <input
                    type="time"
                    value={window.end}
                    onChange={(e) => updateWindow(day, index, { end: e.target.value })}
                    style={{ width: "auto" }}
                    aria-label={`${DAY_LABELS[day]} closing time`}
                  />
                  <button
                    className="btn danger small"
                    type="button"
                    onClick={() => removeWindow(day, index)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Booking rules</h2>
        <div className="field-row">
          <div className="field">
            <label htmlFor="granularity">Slots start every (minutes)</label>
            <select
              id="granularity"
              value={slotGranularityMinutes}
              onChange={(e) => setSlotGranularity(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="buffer">Gap between appointments (minutes)</label>
            <input
              id="buffer"
              type="number"
              min={0}
              max={120}
              step={5}
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value) || 0)}
            />
          </div>

          <div className="field">
            <label htmlFor="notice">Minimum notice (hours)</label>
            <input
              id="notice"
              type="number"
              min={0}
              max={168}
              value={minNoticeHours}
              onChange={(e) => setMinNoticeHours(Number(e.target.value) || 0)}
            />
          </div>

          <div className="field">
            <label htmlFor="window">Bookable up to (days ahead)</label>
            <input
              id="window"
              type="number"
              min={1}
              max={365}
              value={bookingWindowDays}
              onChange={(e) => setBookingWindowDays(Number(e.target.value) || 1)}
            />
          </div>
        </div>
      </section>

      <div>
        <button className="btn" type="button" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save availability"}
        </button>
      </div>
    </div>
  );
}
