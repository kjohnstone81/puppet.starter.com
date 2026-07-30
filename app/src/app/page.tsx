import Link from "next/link";
import { listServices } from "@/lib/db";
import { loadTenant } from "@/lib/tenant-cache";
import { withTimeout } from "@/lib/with-timeout";
import { SiteFooter, SiteHeader, formatDuration, formatPrice } from "@/components/site-chrome";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Start both reads before awaiting either — they're independent, and the
  // layout has already warmed the tenant read through the same cache.
  const tenantPromise = loadTenant();
  const servicesPromise = withTimeout(
    listServices({ activeOnly: true }),
    5000,
    "Firestore services read",
  ).catch((error: unknown) => {
    console.error("Failed to list services", error);
    return null;
  });

  const [tenant, services] = await Promise.all([tenantPromise, servicesPromise]);
  const { copy } = tenant.theme;

  return (
    <>
      <SiteHeader tenant={tenant} />

      <main className="shell">
        <section className="hero">
          <span className="tagline">{copy.tagline}</span>
          <h1>{copy.heroHeading}</h1>
          <p className="lede">{copy.heroSubheading}</p>
        </section>

        {services === null ? (
          <div className="notice error">
            We couldn&apos;t load our services just now. Please try again in a moment.
          </div>
        ) : null}

        {services?.length === 0 ? (
          <div className="notice">
            No services are bookable yet. If you&apos;re the owner, add one in the{" "}
            <Link href="/admin/services">admin portal</Link>.
          </div>
        ) : null}

        <section aria-label="Services" className="service-grid">
          {(services ?? []).map((service: Service) => (
            <article key={service.id} className="card service-card">
              <h3>{service.name}</h3>
              <p className="description">{service.description}</p>
              <div className="service-meta">
                <span className="pill">{formatDuration(service.durationMinutes)}</span>
                <span className="pill">{formatPrice(service.priceCents, service.currency)}</span>
              </div>
              <Link className="btn" href={`/book/${service.id}`}>
                {copy.bookButtonLabel}
              </Link>
            </article>
          ))}
        </section>
      </main>

      <SiteFooter tenant={tenant} />
    </>
  );
}
