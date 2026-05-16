import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  status: z.enum(["pending_review", "converted", "rejected", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createBodySchema = z.object({
  pickupAddress: z.string().trim().min(1).max(500),
  pickupCity: z.string().trim().max(100).optional(),
  pickupState: z.string().trim().max(100).optional(),
  pickupLatitude: z.number().finite().optional(),
  pickupLongitude: z.number().finite().optional(),
  pickupPlaceId: z.string().trim().max(200).optional(),
  deliveryAddress: z.string().trim().min(1).max(500),
  deliveryCity: z.string().trim().max(100).optional(),
  deliveryState: z.string().trim().max(100).optional(),
  deliveryLatitude: z.number().finite().optional(),
  deliveryLongitude: z.number().finite().optional(),
  deliveryPlaceId: z.string().trim().max(200).optional(),
  cargoDescription: z.string().trim().min(1).max(300),
  cargoWeightKg: z.number().int().positive().optional(),
  cargoType: z.string().trim().max(50).optional(),
  specialInstructions: z.string().trim().max(500).optional(),
  preferredPickupAt: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
});

function normalize(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    requestNumber: row.request_number as string,
    status: row.status as string,
    source: row.source as string,
    pickupAddress: (row.pickup_address as string) ?? "",
    pickupCity: (row.pickup_city as string | null) ?? null,
    pickupState: (row.pickup_state as string | null) ?? null,
    deliveryAddress: (row.delivery_address as string) ?? "",
    deliveryCity: (row.delivery_city as string | null) ?? null,
    deliveryState: (row.delivery_state as string | null) ?? null,
    cargoDescription: (row.cargo_description as string) ?? "",
    preferredPickupAt: (row.preferred_pickup_at as string | null) ?? null,
    deliveryRequestId: (row.delivery_request_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function GET(request: Request) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid query parameters" }, { status: 400 });
  }

  const { status, limit, offset } = parsed.data;

  const { data, error } = await actorResult.supabase.rpc(
    "portal_trip_request_list_v1",
    {
      p_status: status ?? null,
      p_limit: limit,
      p_offset: offset,
    } as never,
  );

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_trip_request_list_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to fetch requests" },
      { status: 500 },
    );
  }

  const result = (data ?? { total: 0, limit, offset, items: [] }) as {
    total: number;
    limit: number;
    offset: number;
    items: Array<Record<string, unknown>>;
  };

  return NextResponse.json({
    ok: true,
    data: {
      total: result.total ?? 0,
      limit: result.limit ?? limit,
      offset: result.offset ?? offset,
      items: (result.items ?? []).map(normalize),
    },
  });
}

export async function POST(request: Request) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = createBodySchema.safeParse(json);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, message: firstIssue?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const payload: Record<string, string | null> = {
    pickup_address: input.pickupAddress,
    pickup_city: input.pickupCity ?? null,
    pickup_state: input.pickupState ?? null,
    pickup_latitude: input.pickupLatitude != null ? String(input.pickupLatitude) : null,
    pickup_longitude: input.pickupLongitude != null ? String(input.pickupLongitude) : null,
    pickup_place_id: input.pickupPlaceId ?? null,
    delivery_address: input.deliveryAddress,
    delivery_city: input.deliveryCity ?? null,
    delivery_state: input.deliveryState ?? null,
    delivery_latitude: input.deliveryLatitude != null ? String(input.deliveryLatitude) : null,
    delivery_longitude: input.deliveryLongitude != null ? String(input.deliveryLongitude) : null,
    delivery_place_id: input.deliveryPlaceId ?? null,
    cargo_description: input.cargoDescription,
    cargo_weight_kg: input.cargoWeightKg != null ? String(input.cargoWeightKg) : null,
    cargo_type: input.cargoType ?? "general",
    special_instructions: input.specialInstructions ?? null,
    preferred_pickup_at: input.preferredPickupAt ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await actorResult.supabase.rpc(
    "portal_trip_request_create_v1",
    { p_input: payload } as never,
  );

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_trip_request_create_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to create request" },
      { status: 500 },
    );
  }

  const result = data as { id: string; request_number: string; status: string } | null;
  if (!result) {
    return NextResponse.json({ ok: false, message: "Unable to create request" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        id: result.id,
        requestNumber: result.request_number,
        status: result.status,
      },
    },
    { status: 201 },
  );
}
