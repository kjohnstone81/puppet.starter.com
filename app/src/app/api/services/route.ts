import { NextResponse } from "next/server";
import { listServices } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const services = await listServices({ activeOnly: true });
    return NextResponse.json({ services });
  } catch (error) {
    console.error("GET /api/services failed", error);
    return NextResponse.json({ error: "Could not load services." }, { status: 500 });
  }
}
