import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadTenant } from "@/lib/tenant-cache";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/admin");

  const [tenant, { error }] = await Promise.all([loadTenant(), searchParams]);

  return (
    <>
      <SiteHeader tenant={tenant} />
      <main className="shell" style={{ maxWidth: 520, paddingTop: "4rem" }}>
        <h1>Owner sign in</h1>
        <p className="lede">
          Sign in with the Google account that owns the calendar. The same grant lets{" "}
          {tenant.businessName} read your free/busy times and add bookings.
        </p>

        {error ? <div className="notice error">{error}</div> : null}

        <a className="btn" href="/api/auth/login">
          Continue with Google
        </a>

        <p className="muted" style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          Only the configured owner address can sign in. Everyone else is turned away even with a
          valid Google account.
        </p>
      </main>
      <SiteFooter tenant={tenant} />
    </>
  );
}
