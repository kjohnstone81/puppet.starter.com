export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not respond within ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Caps how long a dependency may stall a request.
 *
 * The Google client libraries retry hard on credential and network failures —
 * a misconfigured runtime service account takes ~15 seconds to surface an
 * error, and an unreachable backend can take far longer. On a page render
 * that turns a clear failure into an apparent hang, so bound it and let the
 * caller decide what to show instead.
 *
 * The underlying promise is not cancelled (the Firestore SDK offers no
 * cancellation); it is simply no longer awaited.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
