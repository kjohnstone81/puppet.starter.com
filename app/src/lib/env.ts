/**
 * Environment access. Values are read lazily so that `next build` — which
 * imports modules without a runtime environment — never throws.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See app/.env.example for the full list.`,
    );
  }
  return value;
}

export const env = {
  get projectId(): string {
    return process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "";
  },
  get firestoreDatabaseId(): string {
    return process.env.FIRESTORE_DATABASE_ID || "(default)";
  },
  get assetsBucket(): string {
    return required("ASSETS_BUCKET");
  },
  /**
   * Only set when the site is served from a known fixed URL (custom domain).
   * Left empty, request handlers fall back to the request's own origin.
   */
  get publicBaseUrl(): string {
    return (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  },
  get googleClientId(): string {
    return required("GOOGLE_OAUTH_CLIENT_ID");
  },
  get googleClientSecret(): string {
    return required("GOOGLE_OAUTH_CLIENT_SECRET");
  },
  get adminEmail(): string {
    return required("ADMIN_EMAIL").toLowerCase();
  },
  get sessionSecret(): string {
    return required("SESSION_SECRET");
  },
  get anthropicApiKey(): string {
    return required("ANTHROPIC_API_KEY");
  },
  get hasAnthropicKey(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },
};
