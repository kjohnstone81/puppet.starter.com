import { Firestore } from "@google-cloud/firestore";
import { env } from "./env";
import { DEFAULT_THEME, defaultTenant } from "./defaults";
import type { Booking, Service, Tenant, Theme } from "./types";

/**
 * Firestore layout (single tenant today, but keyed so multi-tenant is a change
 * of TENANT_ID rather than a change of shape):
 *
 *   tenants/{tenantId}                      — settings, branding, theme
 *   tenants/{tenantId}/services/{serviceId}
 *   tenants/{tenantId}/bookings/{bookingId}
 *   tenants/{tenantId}/private/google       — OAuth refresh token (never served)
 */

export const TENANT_ID = process.env.TENANT_ID || "default";

let client: Firestore | null = null;

export function db(): Firestore {
  if (!client) {
    client = new Firestore({
      projectId: env.projectId || undefined,
      databaseId: env.firestoreDatabaseId,
      ignoreUndefinedProperties: true,
    });
  }
  return client;
}

function tenantRef() {
  return db().collection("tenants").doc(TENANT_ID);
}

export async function getTenant(): Promise<Tenant> {
  const snap = await tenantRef().get();
  const fallback = defaultTenant(process.env.ADMIN_EMAIL?.toLowerCase() ?? "");
  if (!snap.exists) return fallback;

  const data = snap.data() as Partial<Tenant>;
  // Merge over the defaults so a document written by an older version of the
  // app never leaves a required field undefined.
  return {
    ...fallback,
    ...data,
    workingHours: { ...fallback.workingHours, ...(data.workingHours ?? {}) },
    theme: mergeTheme(fallback.theme, data.theme),
  };
}

function mergeTheme(base: Theme, override?: Partial<Theme>): Theme {
  if (!override) return base;
  return {
    ...base,
    ...override,
    palette: { ...base.palette, ...(override.palette ?? {}) },
    darkPalette: { ...base.darkPalette, ...(override.darkPalette ?? {}) },
    typography: { ...base.typography, ...(override.typography ?? {}) },
    radius: { ...base.radius, ...(override.radius ?? {}) },
    style: { ...base.style, ...(override.style ?? {}) },
    copy: { ...base.copy, ...(override.copy ?? {}) },
  };
}

export async function updateTenant(patch: Partial<Tenant>): Promise<void> {
  await tenantRef().set(patch, { merge: true });
}

export async function ensureTenant(ownerEmail: string): Promise<void> {
  const snap = await tenantRef().get();
  if (!snap.exists) {
    await tenantRef().set({ ...defaultTenant(ownerEmail), theme: DEFAULT_THEME });
  }
}

/* ---------------------------------------------------------------- services */

export async function listServices(opts: { activeOnly?: boolean } = {}): Promise<Service[]> {
  const snap = await tenantRef().collection("services").get();
  const services = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, "id">) }));
  const filtered = opts.activeOnly ? services.filter((s) => s.active) : services;
  return filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getService(id: string): Promise<Service | null> {
  const snap = await tenantRef().collection("services").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<Service, "id">) };
}

export async function createService(input: Omit<Service, "id">): Promise<Service> {
  const ref = await tenantRef().collection("services").add(input);
  return { id: ref.id, ...input };
}

export async function updateService(id: string, patch: Partial<Service>): Promise<void> {
  const { id: _ignored, ...rest } = patch;
  void _ignored;
  await tenantRef().collection("services").doc(id).set(rest, { merge: true });
}

export async function deleteService(id: string): Promise<void> {
  await tenantRef().collection("services").doc(id).delete();
}

/* ---------------------------------------------------------------- bookings */

export async function createBooking(input: Omit<Booking, "id">): Promise<Booking> {
  const ref = await tenantRef().collection("bookings").add(input);
  return { id: ref.id, ...input };
}

export async function getBooking(id: string): Promise<Booking | null> {
  const snap = await tenantRef().collection("bookings").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<Booking, "id">) };
}

export async function updateBooking(id: string, patch: Partial<Booking>): Promise<void> {
  await tenantRef().collection("bookings").doc(id).set(patch, { merge: true });
}

/** Bookings that overlap [fromIso, toIso), confirmed only. */
export async function listBookingsBetween(fromIso: string, toIso: string): Promise<Booking[]> {
  const snap = await tenantRef()
    .collection("bookings")
    .where("startsAt", ">=", fromIso)
    .where("startsAt", "<", toIso)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, "id">) }))
    .filter((b) => b.status === "confirmed")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function listUpcomingBookings(limit = 50): Promise<Booking[]> {
  const snap = await tenantRef()
    .collection("bookings")
    .where("startsAt", ">=", new Date().toISOString())
    .orderBy("startsAt", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, "id">) }));
}

/* ------------------------------------------------------- oauth credentials */

interface StoredGoogleCredentials {
  refreshToken: string;
  scope: string;
  email: string;
  updatedAt: string;
}

export async function saveGoogleCredentials(creds: StoredGoogleCredentials): Promise<void> {
  await tenantRef().collection("private").doc("google").set(creds, { merge: true });
}

export async function getGoogleCredentials(): Promise<StoredGoogleCredentials | null> {
  const snap = await tenantRef().collection("private").doc("google").get();
  if (!snap.exists) return null;
  return snap.data() as StoredGoogleCredentials;
}

export async function clearGoogleCredentials(): Promise<void> {
  await tenantRef().collection("private").doc("google").delete();
}
