import { NextResponse, type NextRequest } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-helpers";
import { deleteService, getService, updateService } from "@/lib/db";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withAdmin(async (request: NextRequest, context: Context) => {
  const { id } = await context.params;
  const existing = await getService(id);
  if (!existing) {
    return NextResponse.json({ error: "That service no longer exists." }, { status: 404 });
  }

  const body = (await request.json()) as Partial<Service>;
  const patch: Partial<Service> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return badRequest("A service needs a name.");
    patch.name = name;
  }
  if (body.description !== undefined) patch.description = body.description.trim();
  if (body.durationMinutes !== undefined) {
    const duration = Number(body.durationMinutes);
    if (!Number.isFinite(duration) || duration < 5 || duration > 480) {
      return badRequest("Duration must be between 5 minutes and 8 hours.");
    }
    patch.durationMinutes = Math.round(duration);
  }
  if (body.priceCents !== undefined) {
    patch.priceCents = Math.max(0, Math.round(Number(body.priceCents) || 0));
  }
  if (body.currency !== undefined) patch.currency = body.currency.toUpperCase().slice(0, 3);
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0;

  await updateService(id, patch);

  return NextResponse.json({ service: { ...existing, ...patch, id } });
});

export const DELETE = withAdmin(async (_request: NextRequest, context: Context) => {
  const { id } = await context.params;
  await deleteService(id);
  return NextResponse.json({ ok: true });
});
