import Link from "next/link";
import { notFound } from "next/navigation";
import { getService } from "@/lib/db";
import { loadTenant } from "@/lib/tenant-cache";
import { SiteFooter, SiteHeader, formatDuration, formatPrice } from "@/components/site-chrome";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const [tenant, service] = await Promise.all([loadTenant(), getService(serviceId)]);

  if (!service || !service.active) notFound();

  return (
    <>
      <SiteHeader tenant={tenant} />

      <main className="shell">
        <p style={{ marginTop: "2rem" }}>
          <Link href="/">← All services</Link>
        </p>

        <h1>{service.name}</h1>
        <div className="service-meta" style={{ marginBottom: "1.5rem" }}>
          <span className="pill">{formatDuration(service.durationMinutes)}</span>
          <span className="pill">{formatPrice(service.priceCents, service.currency)}</span>
          <span className="pill">Times shown in {tenant.timezone}</span>
        </div>
        {service.description ? <p className="lede">{service.description}</p> : null}

        <BookingFlow
          serviceId={service.id}
          serviceName={service.name}
          timezone={tenant.timezone}
          bookButtonLabel={tenant.theme.copy.bookButtonLabel}
        />
      </main>

      <SiteFooter tenant={tenant} />
    </>
  );
}
