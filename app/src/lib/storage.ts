import { Storage } from "@google-cloud/storage";
import { env } from "./env";

let client: Storage | null = null;

function storage(): Storage {
  if (!client) {
    client = new Storage({ projectId: env.projectId || undefined });
  }
  return client;
}

export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;

export interface UploadedLogo {
  objectPath: string;
  contentType: string;
}

/**
 * Store the logo in the assets bucket. The bucket is private — the object is
 * read back through /api/logo using the runtime service account, so nothing
 * has to be world-readable and the logo is served from the site's own domain.
 */
export async function uploadLogo(
  bytes: Buffer,
  contentType: string,
  originalName: string,
): Promise<UploadedLogo> {
  const extension = extensionFor(contentType, originalName);
  const objectPath = `logos/${Date.now()}-${crypto.randomUUID()}${extension}`;

  const file = storage().bucket(env.assetsBucket).file(objectPath);
  await file.save(bytes, { contentType });

  return { objectPath, contentType };
}

function extensionFor(contentType: string, originalName: string): string {
  const fromName = originalName.match(/\.[a-zA-Z0-9]{1,5}$/)?.[0];
  if (fromName) return fromName.toLowerCase();
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

/** Fetch a stored object's bytes — used to serve the logo and to re-theme from it. */
export async function readObject(objectPath: string): Promise<Buffer> {
  const [contents] = await storage().bucket(env.assetsBucket).file(objectPath).download();
  return contents;
}

/** Media type implied by a stored object's extension. */
export function mediaTypeForPath(path: string): string {
  switch (path.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/png";
  }
}
