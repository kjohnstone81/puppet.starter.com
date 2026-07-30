import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadTenant } from "@/lib/tenant-cache";
import { SiteFooter } from "@/components/site-chrome";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const tenant = await loadTenant();

  return (
    <>
      <header className="site-header">
        <div className="shell">
          <Link className="brand" href="/">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt="" />
            ) : null}
            <span>{tenant.businessName}</span>
          </Link>
          <div className="row-between" style={{ gap: "0.75rem" }}>
            <span className="muted" style={{ fontSize: "0.875rem" }}>
              {session.email}
            </span>
            <form action="/api/auth/logout" method="post">
              <button className="btn secondary small" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="shell">
        <AdminNav />
        {children}
      </main>

      <SiteFooter tenant={tenant} />
    </>
  );
}
