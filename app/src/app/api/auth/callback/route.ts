import { NextResponse, type NextRequest } from "next/server";
import {
  consumeOAuthState,
  createSession,
  exchangeCodeForTokens,
  redirectUriFor,
  verifyIdToken,
} from "@/lib/auth";
import { ensureTenant, saveGoogleCredentials, updateTenant } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * OAuth callback. One grant does two jobs: it proves the caller is the business
 * owner (so they may use /admin), and it yields the refresh token the server
 * later uses to read free/busy and write events to that same calendar.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  const code = params.get("code");
  const state = params.get("state");

  const expectedState = await consumeOAuthState();

  if (error) {
    return redirectToLogin(request, `Google sign-in was cancelled (${error}).`);
  }
  if (!code) {
    return redirectToLogin(request, "Google did not return an authorization code.");
  }
  if (!state || !expectedState || state !== expectedState) {
    return redirectToLogin(request, "Sign-in state did not match. Please try again.");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUriFor(request.nextUrl.origin));
    const identity = await verifyIdToken(tokens.id_token);

    if (!identity.emailVerified) {
      return redirectToLogin(request, "That Google account has no verified email address.");
    }
    if (identity.email !== env.adminEmail) {
      return redirectToLogin(
        request,
        `${identity.email} is not the owner account for this site.`,
      );
    }

    await ensureTenant(identity.email);

    if (tokens.refresh_token) {
      await saveGoogleCredentials({
        refreshToken: tokens.refresh_token,
        scope: tokens.scope,
        email: identity.email,
        updatedAt: new Date().toISOString(),
      });
      await updateTenant({ calendarConnected: true, ownerEmail: identity.email });
    }

    await createSession({
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
    });

    return NextResponse.redirect(new URL("/admin", request.nextUrl.origin));
  } catch (err) {
    console.error("OAuth callback failed", err);
    return redirectToLogin(request, "Sign-in failed. Check the server logs for details.");
  }
}

function redirectToLogin(request: NextRequest, message: string) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
