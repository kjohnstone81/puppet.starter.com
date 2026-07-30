import { loadTenant } from "@/lib/tenant-cache";
import { AvailabilityEditor } from "./availability-editor";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const tenant = await loadTenant();

  return (
    <>
      <h1>Availability</h1>
      <p className="lede">
        These are the hours you&apos;re open for bookings. Anything already on your Google Calendar
        inside those hours is treated as busy, so a slot only shows when you are genuinely free.
      </p>

      <AvailabilityEditor tenant={tenant} />
    </>
  );
}
