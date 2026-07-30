import { NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError } from "./auth";

/**
 * Wraps an admin route handler with the owner check and a single error
 * translation point, so individual routes stay focused on their own work.
 */
export function withAdmin<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      await requireAdmin();
      return await handler(...args);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Sign in as the business owner." }, { status: 401 });
      }
      console.error("Admin route failed", error);
      const message =
        error instanceof Error ? error.message : "Something went wrong on the server.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
