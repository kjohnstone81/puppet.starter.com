import { NextResponse } from "next/server";
import { getTenant } from "@/lib/db";
import { mediaTypeForPath, readObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Serves the business's logo from the private assets bucket.
 *
 * Keeping the bucket private means no anonymous IAM binding anywhere in the
 * project, and the logo is served from the site's own domain — which is the
 * right behaviour for a white-label product.
 *
 * The tenant's stored logo URL carries a `?v=` stamp that changes on every
 * upload, so the immutable cache header below is safe: a new logo is a new URL.
 */
export async function GET() {
  try {
    const tenant = await getTenant();
    if (!tenant.logoObjectPath) {
      return new NextResponse(null, { status: 404 });
    }

    const bytes = await readObject(tenant.logoObjectPath);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mediaTypeForPath(tenant.logoObjectPath),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (error) {
    console.error("GET /api/logo failed", error);
    return new NextResponse(null, { status: 404 });
  }
}
