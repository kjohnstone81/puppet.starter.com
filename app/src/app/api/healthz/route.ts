import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness only — deliberately does not touch Firestore or Google, so a
 * downstream outage doesn't cause Cloud Run to cycle otherwise-healthy
 * instances.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", time: new Date().toISOString() });
}
