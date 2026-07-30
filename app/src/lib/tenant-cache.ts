import { cache } from "react";
import { defaultTenant } from "./defaults";
import { getTenant } from "./db";
import { withTimeout } from "./with-timeout";
import type { Tenant } from "./types";

/** Every page render needs the tenant, so don't let one slow read hold the site up. */
const TENANT_READ_TIMEOUT_MS = 4000;

/**
 * Per-request memoised tenant read. The layout, its metadata, and the page
 * itself all need the tenant; `cache` collapses those into one Firestore read.
 *
 * Failures fall back to defaults rather than throwing: a booking site that
 * renders unbranded is better than one that 500s or hangs, and the admin
 * portal surfaces the underlying error where someone can act on it.
 */
export const loadTenant = cache(async (): Promise<Tenant> => {
  try {
    return await withTimeout(getTenant(), TENANT_READ_TIMEOUT_MS, "Firestore tenant read");
  } catch (error) {
    console.error("Failed to load tenant; falling back to defaults", error);
    return defaultTenant(process.env.ADMIN_EMAIL?.toLowerCase() ?? "");
  }
});
