import { NextResponse, type NextRequest } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-helpers";
import { createService } from "@/lib/db";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (request: NextRequest) => {
  const body = (await request.json()) as Partial<Service>;

  const name = body.name?.trim();
  if (!name) return badRequest("A service needs a name.");

  const durationMinutes = Number(body.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    return badRequest("Duration must be between 5 minutes and 8 hours.");
  }

  const priceCents = Math.max(0, Math.round(Number(body.priceCents) || 0));

  const service = await createService({
    name,
    description: body.description?.trim() ?? "",
    durationMinutes: Math.round(durationMinutes),
    priceCents,
    currency: (body.currency ?? "GBP").toUpperCase().slice(0, 3),
    active: body.active !== false,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
  });

  return NextResponse.json({ service });
});
