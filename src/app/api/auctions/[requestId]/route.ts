import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

function normalizeDetail(row: Record<string, unknown>) {
  const num = (v: unknown) => (v != null ? Number(v) : null);
  return {
    requestId: row.request_id as string,
    requestNumber: (row.request_number as string) ?? "",
    status: row.status as string,
    pickupAddress: (row.pickup_formatted_address as string | null) ?? null,
    pickupCity: (row.pickup_city as string | null) ?? null,
    pickupState: (row.pickup_state as string | null) ?? null,
    pickupContactName: (row.pickup_contact_name as string | null) ?? null,
    pickupContactPhone: (row.pickup_contact_phone as string | null) ?? null,
    deliveryAddress: (row.delivery_formatted_address as string | null) ?? null,
    deliveryCity: (row.delivery_city as string | null) ?? null,
    deliveryState: (row.delivery_state as string | null) ?? null,
    deliveryContactName: (row.delivery_contact_name as string | null) ?? null,
    deliveryContactPhone: (row.delivery_contact_phone as string | null) ?? null,
    vehicleType: (row.vehicle_type as string | null) ?? null,
    cargoDescription: (row.cargo_description as string | null) ?? null,
    cargoWeightKg: num(row.cargo_weight_kg),
    cargoType: (row.cargo_type as string | null) ?? null,
    specialInstructions: (row.special_instructions as string | null) ?? null,
    estimatedDistanceKm: num(row.estimated_distance_km),
    estimatedDurationMinutes: num(row.estimated_duration_minutes),
    consignmentDate: (row.consignment_date as string | null) ?? null,
    auctionStartTime: (row.auction_start_time as string | null) ?? null,
    auctionEndTime: (row.auction_end_time as string | null) ?? null,
    auctionDurationMinutes: num(row.auction_duration_minutes),
    totalBidsCount: Number(row.total_bids_count ?? 0),
    lowestBidAmount: num(row.lowest_bid_amount),
    winnerBidId: (row.winner_bid_id as string | null) ?? null,
    winnerSelectedAt: (row.winner_selected_at as string | null) ?? null,
    tripId: (row.trip_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ ok: false, message: "requestId is required" }, { status: 400 });
  }

  const { data, error } = await actorResult.supabase.rpc("portal_auction_detail_v1", {
    p_request_id: requestId,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_auction_detail_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Auction not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to fetch auction" },
      { status: 500 },
    );
  }

  const row = data as Record<string, unknown> | null;
  if (!row) {
    return NextResponse.json({ ok: false, message: "Auction not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: normalizeDetail(row) });
}
