"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Palette, Tenant, Theme } from "@/lib/types";

interface Props {
  tenant: Tenant;
  generationEnabled: boolean;
}

export function BrandingStudio({ tenant, generationEnabled }: Props) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logoUrl);
  const [guidance, setGuidance] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setStatus("Uploading logo…");

    try {
      const body = new FormData();
      body.append("logo", file);
      const res = await fetch("/api/admin/branding/logo", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed.");

      setLogoUrl(json.logoUrl as string);
      setStatus("Logo uploaded. Generate a theme when you're ready.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus(null);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setStatus("Reading your logo and designing the site… this takes up to a minute.");

    try {
      const res = await fetch("/api/admin/branding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidance: guidance.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Theme generation failed.");

      setStatus(json.warning ?? "New theme applied. The whole site is using it now.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Theme generation failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function resetTheme() {
    if (!window.confirm("Reset to the default neutral theme?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branding/reset", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Could not reset the theme.");
      }
      setStatus("Back to the default theme.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the theme.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error ? <div className="notice error">{error}</div> : null}
      {status ? <div className="notice success">{status}</div> : null}

      <section className="card">
        <h2>Logo</h2>
        {logoUrl ? (
          <p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Current logo"
              style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }}
            />
          </p>
        ) : (
          <p className="muted">No logo uploaded yet.</p>
        )}

        <div className="field">
          <label htmlFor="logo">Upload a PNG, JPEG, WebP, or GIF (up to 4 MB)</label>
          <input
            id="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={uploadLogo}
            disabled={busy}
          />
        </div>
      </section>

      <section className="card">
        <h2>Generate the theme</h2>
        <p className="muted">
          The model works from the logo itself — the colours in the mark become the palette, and its
          character drives the type and copy.
        </p>

        <div className="field">
          <label htmlFor="guidance">Any direction? (optional)</label>
          <input
            id="guidance"
            placeholder="e.g. warmer and less corporate, keep it high-contrast"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="row-between" style={{ justifyContent: "flex-start" }}>
          <button
            className="btn"
            type="button"
            onClick={generate}
            disabled={busy || !logoUrl || !generationEnabled}
          >
            {busy ? "Working…" : "Generate from logo"}
          </button>
          <button className="btn secondary" type="button" onClick={resetTheme} disabled={busy}>
            Reset to default
          </button>
        </div>

        {!logoUrl ? <p className="muted">Upload a logo first.</p> : null}
      </section>

      <ThemePreview theme={tenant.theme} />
    </div>
  );
}

function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <section className="card">
      <h2>Current theme</h2>
      <p className="muted">
        <strong>{theme.style.vibe}</strong> — {theme.style.rationale}
      </p>
      <p className="muted">
        Headings in {theme.typography.headingFont}, body in {theme.typography.bodyFont}.
        {theme.generatedAt
          ? ` Generated ${new Date(theme.generatedAt).toLocaleString("en-GB")}.`
          : " This is the built-in default."}
      </p>

      <h3>Light</h3>
      <Swatches palette={theme.palette} />
      <h3>Dark</h3>
      <Swatches palette={theme.darkPalette} />

      <h3>Copy</h3>
      <table>
        <tbody>
          <tr>
            <th>Tagline</th>
            <td>{theme.copy.tagline}</td>
          </tr>
          <tr>
            <th>Hero heading</th>
            <td>{theme.copy.heroHeading}</td>
          </tr>
          <tr>
            <th>Hero subheading</th>
            <td>{theme.copy.heroSubheading}</td>
          </tr>
          <tr>
            <th>Button label</th>
            <td>{theme.copy.bookButtonLabel}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function Swatches({ palette }: { palette: Palette }) {
  return (
    <div className="swatches">
      {(Object.keys(palette) as (keyof Palette)[]).map((key) => (
        <div className="swatch" key={key}>
          <span style={{ background: palette[key] }} />
          {key}
        </div>
      ))}
    </div>
  );
}
