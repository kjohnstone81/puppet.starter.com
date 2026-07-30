import { NextResponse, type NextRequest } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-helpers";
import { updateTenant } from "@/lib/db";
import { ALLOWED_LOGO_TYPES, MAX_LOGO_BYTES, uploadLogo } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (request: NextRequest) => {
  const form = await request.formData();
  const file = form.get("logo");

  if (!(file instanceof File)) {
    return badRequest("Attach an image file in the `logo` field.");
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return badRequest("Logos must be PNG, JPEG, WebP, or GIF.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    return badRequest("That logo is larger than 4 MB.");
  }
  if (file.size === 0) {
    return badRequest("That file is empty.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadLogo(bytes, file.type, file.name);

  // The `v` stamp changes on every upload, which is what lets /api/logo serve
  // the image with an immutable cache header without ever going stale.
  const logoUrl = `/api/logo?v=${Date.now()}`;

  await updateTenant({ logoUrl, logoObjectPath: uploaded.objectPath });

  return NextResponse.json({ logoUrl });
});
