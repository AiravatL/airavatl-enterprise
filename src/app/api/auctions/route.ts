import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  status: z
    .enum(["draft", "active", "ended", "winner_selected", "trip_created", "cancelled"])
    .optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createBodySchema = z.object({
  pickupAddress: z.string().trim().min(1).max(500),
  pickupCity: z.string().trim().max(100).optional(),
  pickupState: z.string().trim().max(100).optional(),
  pickupLatitude: z.number().finite(),
  pickupLongitude: z.number().finite(),
  pickupPlaceId: z.string().trim().max(200).optional(),
  pickupPrimaryText: z.string().trim().max(300).optional(),
  pickupSecondaryText: z.string().trim().max(300).optional(),
  pickupContactName: z.string().trim().max(120).optional(),
  pickupContactPhone: z.string().trim().max(20).optional(),
  deliveryAddress: z.string().trim().min(1).max(500),
  deliveryCity: z.string().trim().max(100).optional(),
  deliveryState: z.string().trim().max(100).optional(),
  deliveryLatitude: z.number().finite(),
  deliveryLongitude: z.number().finite(),
  deliveryPlaceId: z.string().trim().max(200).optional(),
  deliveryPrimaryText: z.string().trim().max(300).optional(),
  deliverySecondaryText: z.string().trim().max(300).optional(),
  deliveryContactName: z.string().trim().max(120).optional(),
  deliveryContactPhone: z.string().trim().max(20).optional(),
  vehicleMasterTypeId: z.string().uuid(),
  cargoDescription: z.string().trim().max(300).optional(),
  cargoWeightKg: z.number().int().positive().optional(),
  cargoType: z.string().trim().max(50).optional(),
  specialInstructions: z.string().trim().max(500).optional(),
  consignmentDate: z.string().datetime(),
  scheduledPickupTime: z.string().datetime().optional(),
  auctionDurationMinutes: z.number().int().min(5).max(1440),
});

function normalize(row: Record<string, unknown>) {
  return {
    requestId: row.request_id as string,
    requestNumber: (row.request_number as string) ?? "",
    status: row.status as string,
    pickupCity: (row.pickup_city as string | null) ?? null,
    pickupState: (row.pickup_state as string | null) ?? null,
    deliveryCity: (row.delivery_city as string | null) ?? null,
    deliveryState: (row.delivery_state as string | null) ?? null,
    pickupAddress: (row.pickup_formatted_address as string | null) ?? null,
    deliveryAddress: (row.delivery_formatted_address as string | null) ?? null,
    vehicleType: (row.vehicle_type as string | null) ?? null,
    cargoDescription: (row.cargo_description as string | null) ?? null,
    consignmentDate: (row.consignment_date as string | null) ?? null,
    auctionEndTime: (row.auction_end_time as string | null) ?? null,
    totalBidsCount: Number(row.total_bids_count ?? 0),
    lowestBidAmount: row.lowest_bid_amount != null ? Number(row.lowest_bid_amount) : null,
    winnerBidId: (row.winner_bid_id as string | null) ?? null,
    tripId: (row.trip_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function GET(request: Request) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid query parameters" }, { status: 400 });
  }
  const { status, search, limit, offset } = parsed.data;

  const { data, error } = await actorResult.supabase.rpc("portal_auction_list_v1", {
    p_status: status ?? null,
    p_search: search ?? null,
    p_limit: limit,
    p_offset: offset,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_auction_list_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to fetch auctions" },
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

  const payload: Record<string, unknown> = {
    pickup_formatted_address: input.pickupAddress,
    pickup_latitude: input.pickupLatitude,
    pickup_longitude: input.pickupLongitude,
    pickup_city: input.pickupCity ?? null,
    pickup_state: input.pickupState ?? null,
    pickup_place_id: input.pickupPlaceId ?? null,
    pickup_primary_text: input.pickupPrimaryText ?? null,
    pickup_secondary_text: input.pickupSecondaryText ?? null,
    pickup_contact_name: input.pickupContactName ?? null,
    pickup_contact_phone: input.pickupContactPhone ?? null,
    delivery_formatted_address: input.deliveryAddress,
    delivery_latitude: input.deliveryLatitude,
    delivery_longitude: input.deliveryLongitude,
    delivery_city: input.deliveryCity ?? null,
    delivery_state: input.deliveryState ?? null,
    delivery_place_id: input.deliveryPlaceId ?? null,
    delivery_primary_text: input.deliveryPrimaryText ?? null,
    delivery_secondary_text: input.deliverySecondaryText ?? null,
    delivery_contact_name: input.deliveryContactName ?? null,
    delivery_contact_phone: input.deliveryContactPhone ?? null,
    vehicle_master_type_id: input.vehicleMasterTypeId,
    cargo_description: input.cargoDescription ?? null,
    cargo_weight_kg: input.cargoWeightKg ?? null,
    cargo_type: input.cargoType ?? "general",
    special_instructions: input.specialInstructions ?? null,
    consignment_date: input.consignmentDate,
    scheduled_pickup_time: input.scheduledPickupTime ?? null,
    auction_duration_minutes: input.auctionDurationMinutes,
  };

  const { data, error } = await actorResult.supabase.rpc("portal_auction_create_v1", {
    p_input: payload,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_auction_create_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to create auction" },
      { status: 500 },
    );
  }

  const result = data as { request_id: string; request_number: string; status: string } | null;
  if (!result) {
    return NextResponse.json({ ok: false, message: "Unable to create auction" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        requestId: result.request_id,
        requestNumber: result.request_number,
        status: result.status,
      },
    },
    { status: 201 },
  );
}
