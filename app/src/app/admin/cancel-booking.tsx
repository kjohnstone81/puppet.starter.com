"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Cancel this booking? The customer's calendar invite is withdrawn too.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not cancel that booking.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel that booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn danger small" type="button" onClick={cancel} disabled={busy}>
        {busy ? "Cancelling…" : "Cancel"}
      </button>
      {error ? (
        <div className="muted" style={{ color: "#c0392b", fontSize: "0.8rem" }}>
          {error}
        </div>
      ) : null}
    </>
  );
}
