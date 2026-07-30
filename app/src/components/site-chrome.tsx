import Link from "next/link";
import type { Tenant } from "@/lib/types";

export function SiteHeader({ tenant }: { tenant: Tenant }) {
  return (
    <header className="site-header">
      <div className="shell">
        <Link href="/" className="brand">
          {tenant.logoUrl ? (
            // Served straight from the assets bucket; next/image would add a
            // proxy hop for no benefit on a single small asset.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt={`${tenant.businessName} logo`} />
          ) : null}
          <span>{tenant.businessName}</span>
        </Link>
        <nav>
          <Link className="btn secondary small" href="/admin">
            Owner sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ tenant }: { tenant: Tenant }) {
  return (
    <footer className="site-footer">
      <div className="shell row-between">
        <span>
          © {new Date().getFullYear()} {tenant.businessName}
        </span>
        <span>
          {tenant.contactEmail ? (
            <a href={`mailto:${tenant.contactEmail}`}>{tenant.contactEmail}</a>
          ) : null}
          {tenant.contactEmail && tenant.contactPhone ? " · " : null}
          {tenant.contactPhone ? (
            <a href={`tel:${tenant.contactPhone.replace(/\s/g, "")}`}>{tenant.contactPhone}</a>
          ) : null}
        </span>
      </div>
    </footer>
  );
}

export function formatPrice(priceCents: number, currency: string): string {
  if (priceCents <= 0) return "Free";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
    }).format(priceCents / 100);
  } catch {
    return `${(priceCents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
