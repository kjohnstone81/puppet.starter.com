import type { Metadata } from "next";
import { loadTenant } from "@/lib/tenant-cache";
import { fontHref, themeToCss } from "@/lib/theme-css";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await loadTenant();
  return {
    title: `${tenant.businessName} — Book online`,
    description: tenant.theme.copy.heroSubheading,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await loadTenant();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fontHref(tenant.theme)} />
        <style dangerouslySetInnerHTML={{ __html: themeToCss(tenant.theme) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
