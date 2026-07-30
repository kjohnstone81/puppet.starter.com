"use client";

import { useState } from "react";
import type { Service } from "@/lib/types";

const CURRENCIES = ["GBP", "EUR", "USD", "AUD", "CAD", "NZD"];

interface Props {
  initialServices: Service[];
  defaultCurrency: string;
}

type Draft = Omit<Service, "id"> & { id?: string };

function emptyDraft(currency: string, sortOrder: number): Draft {
  return {
    name: "",
    description: "",
    durationMinutes: 60,
    priceCents: 0,
    currency,
    active: true,
    sortOrder,
  };
}

export function ServicesManager({ initialServices, defaultCurrency }: Props) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setError(null);
    setDraft(emptyDraft(defaultCurrency, services.length));
  }

  function startEdit(service: Service) {
    setError(null);
    setDraft({ ...service });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    if (!draft.name.trim()) {
      setError("Give the service a name.");
      return;
    }
    if (draft.durationMinutes < 5 || draft.durationMinutes > 8 * 60) {
      setError("Duration must be between 5 minutes and 8 hours.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const isUpdate = Boolean(draft.id);
      const res = await fetch(
        isUpdate ? `/api/admin/services/${draft.id}` : "/api/admin/services",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not save that service.");

      const saved = body.service as Service;
      setServices((current) => {
        const next = isUpdate
          ? current.map((s) => (s.id === saved.id ? saved : s))
          : [...current, saved];
        return next.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      });
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that service.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(service: Service) {
    if (!window.confirm(`Delete “${service.name}”? Existing bookings are kept.`)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not delete that service.");
      }
      setServices((current) => current.filter((s) => s.id !== service.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error ? <div className="notice error">{error}</div> : null}

      <div className="row-between">
        <h2 style={{ margin: 0 }}>
          {services.length} service{services.length === 1 ? "" : "s"}
        </h2>
        <button className="btn" type="button" onClick={startNew} disabled={busy || draft !== null}>
          Add a service
        </button>
      </div>

      {draft ? (
        <form className="card" onSubmit={save}>
          <h3>{draft.id ? "Edit service" : "New service"}</h3>

          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="duration">Duration (minutes)</label>
              <input
                id="duration"
                type="number"
                min={5}
                max={480}
                step={5}
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, durationMinutes: Number(e.target.value) || 0 })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="price">Price</label>
              <input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={(draft.priceCents / 100).toFixed(2)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priceCents: Math.round((Number(e.target.value) || 0) * 100),
                  })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="sortOrder">Display order</label>
              <input
                id="sortOrder"
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="active" style={{ display: "inline-flex", gap: "0.5rem" }}>
              <input
                id="active"
                type="checkbox"
                style={{ width: "auto" }}
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Bookable on the public site
            </label>
          </div>

          <div className="row-between" style={{ justifyContent: "flex-start" }}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save service"}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setDraft(null)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {services.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <td>
                    <strong>{service.name}</strong>
                    {service.description ? (
                      <>
                        <br />
                        <span className="muted">{service.description}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{service.durationMinutes} min</td>
                  <td>
                    {(service.priceCents / 100).toFixed(2)} {service.currency}
                  </td>
                  <td>
                    <span className="pill">{service.active ? "Live" : "Hidden"}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn secondary small"
                      type="button"
                      onClick={() => startEdit(service)}
                      disabled={busy}
                    >
                      Edit
                    </button>{" "}
                    <button
                      className="btn danger small"
                      type="button"
                      onClick={() => remove(service)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
