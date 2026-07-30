import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api-helpers";
import { updateTenant } from "@/lib/db";
import { DEFAULT_THEME } from "@/lib/defaults";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async () => {
  await updateTenant({ theme: DEFAULT_THEME });
  return NextResponse.json({ theme: DEFAULT_THEME });
});
