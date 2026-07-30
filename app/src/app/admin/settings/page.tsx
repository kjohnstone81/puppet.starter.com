import { listWritableCalendars } from "@/lib/calendar";
import { loadTenant } from "@/lib/tenant-cache";
import { withTimeout } from "@/lib/with-timeout";
import { SettingsEditor } from "./settings-editor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tenant = await loadTenant();

  let calendars: { id: string; summary: string }[] = [];
  let calendarError: string | null = null;
  try {
    calendars = await withTimeout(listWritableCalendars(), 10000, "Google Calendar list");
  } catch (error) {
    console.error("Could not list calendars", error);
    calendarError =
      "Couldn't list your calendars. Reconnect Google below, then reload this page.";
  }

  return (
    <>
      <h1>Settings</h1>
      <SettingsEditor tenant={tenant} calendars={calendars} calendarError={calendarError} />
    </>
  );
}
