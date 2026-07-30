import { cookies } from "next/headers";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { env } from "./env";

/**
 * Google OAuth + session handling.
 *
 * One OAuth client serves both purposes: it authenticates the business owner
 * into /admin, and its refresh token is what the server uses to read free/busy
 * and write events to that same account's calendar. There is deliberately no
 * second credential to keep in sync.
 */

const SESSION_COOKIE = "wl_session";
const OAUTH_STATE_COOKIE = "wl_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface Session {
  email: string;
  name: string;
  picture?: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

/* ------------------------------------------------------------ authorize URL */

/**
 * Google requires the redirect URI on the token exchange to match the one used
 * on the authorize request byte for byte, so both callers derive it the same
 * way: an explicit PUBLIC_BASE_URL when set (custom domain, proxy in front),
 * otherwise the origin the request actually arrived on. Deriving it means the
 * Cloud Run URL doesn't have to be known before the service is created.
 */
export function redirectUriFor(requestOrigin: string): string {
  const base = (process.env.PUBLIC_BASE_URL || requestOrigin).replace(/\/$/, "");
  return `${base}/api/auth/callback`;
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // offline + consent guarantees a refresh token even on repeat grants,
    // which we need because the server acts on the calendar without a user
    // present.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token: string;
  token_type: string;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export async function verifyIdToken(idToken: string): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.googleClientId,
  });
  return {
    email: String(payload.email ?? "").toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: String(payload.name ?? payload.email ?? ""),
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

/* ----------------------------------------------------------------- session */

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const email = String(payload.email ?? "").toLowerCase();
    if (!email || email !== env.adminEmail) return null;
    return {
      email,
      name: String(payload.name ?? email),
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Throws if the caller is not the configured owner. Use in admin API routes. */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in as the business owner");
    this.name = "UnauthorizedError";
  }
}

/* ------------------------------------------------------------ oauth state */

export async function setOAuthState(state: string): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export async function consumeOAuthState(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(OAUTH_STATE_COOKIE)?.value ?? null;
  store.delete(OAUTH_STATE_COOKIE);
  return value;
}
