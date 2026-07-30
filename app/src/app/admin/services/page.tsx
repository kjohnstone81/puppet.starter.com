import { listServices } from "@/lib/db";
import { withTimeout } from "@/lib/with-timeout";
import { ServicesManager } from "./services-manager";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  let services: Service[] = [];
  let loadError: string | null = null;
  try {
    services = await withTimeout(listServices(), 8000, "Firestore services read");
  } catch (error) {
    console.error("Failed to load services", error);
    loadError = error instanceof Error ? error.message : "Could not read services.";
  }

  return (
    <>
      <h1>Services</h1>
      <p className="lede">
        Each service sets its own duration and price. Duration drives how long a slot blocks out in
        your calendar; only active services appear on the public site.
      </p>

      {loadError ? <div className="notice error">{loadError}</div> : null}

      <ServicesManager initialServices={services} defaultCurrency={inferCurrency(services)} />
    </>
  );
}

function inferCurrency(services: Service[]): string {
  return services[0]?.currency ?? "GBP";
}
