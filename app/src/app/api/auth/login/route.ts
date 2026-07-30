import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl, redirectUriFor, setOAuthState } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID();
  await setOAuthState(state);
  return NextResponse.redirect(buildAuthUrl(state, redirectUriFor(request.nextUrl.origin)));
}
