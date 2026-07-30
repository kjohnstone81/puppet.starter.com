import { loadTenant } from "@/lib/tenant-cache";
import { BrandingStudio } from "./branding-studio";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const tenant = await loadTenant();
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <h1>Branding</h1>
      <p className="lede">
        Upload your logo and the site generates its own look from it — palette, type pairing, corner
        style, and the landing-page copy. Nothing else needs designing.
      </p>

      {!hasAnthropicKey ? (
        <div className="notice error">
          <code>ANTHROPIC_API_KEY</code> isn&apos;t set on this deployment, so theme generation is
          unavailable. Add it to Secret Manager and redeploy.
        </div>
      ) : null}

      <BrandingStudio tenant={tenant} generationEnabled={hasAnthropicKey} />
    </>
  );
}
