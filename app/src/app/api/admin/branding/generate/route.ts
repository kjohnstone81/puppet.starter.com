import { NextResponse, type NextRequest } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-helpers";
import { generateThemeFromLogo } from "@/lib/branding";
import { getTenant, updateTenant } from "@/lib/db";
import { env } from "@/lib/env";
import { mediaTypeForPath, readObject } from "@/lib/storage";

export const dynamic = "force-dynamic";
// Vision plus a full design system takes tens of seconds; Cloud Run's own
// request timeout is set higher than this in Terraform.
export const maxDuration = 120;

export const POST = withAdmin(async (request: NextRequest) => {
  if (!env.hasAnthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY isn't configured on this deployment." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { guidance?: string };
  const tenant = await getTenant();

  if (!tenant.logoObjectPath) {
    return badRequest("Upload a logo before generating a theme.");
  }

  const logoBytes = await readObject(tenant.logoObjectPath);

  const { theme, warning } = await generateThemeFromLogo({
    logoBytes,
    logoMediaType: mediaTypeForPath(tenant.logoObjectPath),
    businessName: tenant.businessName,
    guidance: body.guidance?.slice(0, 300),
  });

  // On a refusal the caller gets the default theme back for display, but the
  // stored theme is left alone — a decline shouldn't wipe a working design.
  if (!warning) {
    await updateTenant({ theme });
  }

  return NextResponse.json({ theme, warning });
});
