import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

interface RawBidder {
  id?: string;
  userId?: string;
  name?: string | null;
  phone?: string | null;
  rating?: number | null;
  totalTripsCompleted?: number | null;
  completionRate?: number | null;
}

interface RawVehicle {
  registrationNumber?: string | null;
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
  capacityTons?: number | null;
  bodyType?: string | null;
}

interface RawBid {
  id: string;
  bidAmount: number | string;
  estimatedPickupTime?: string | null;
  estimatedDeliveryTime?: string | null;
  bidNotes?: string | null;
  status: string;
  createdAt: string;
  bidderId: string;
  bidderType: string;
  bidder?: RawBidder | null;
  vehicle?: RawVehicle | null;
}

function normalizeBid(b: RawBid) {
  return {
    id: b.id,
    bidAmount: Number(b.bidAmount),
    estimatedPickupTime: b.estimatedPickupTime ?? null,
    estimatedDeliveryTime: b.estimatedDeliveryTime ?? null,
    bidNotes: b.bidNotes ?? null,
    status: b.status,
    createdAt: b.createdAt,
    bidderId: b.bidderId,
    bidderType: b.bidderType,
    bidderName: b.bidder?.name ?? null,
    bidderPhone: b.bidder?.phone ?? null,
    bidderRating: b.bidder?.rating ?? null,
    bidderTripsCompleted: b.bidder?.totalTripsCompleted ?? null,
    vehicleRegistration: b.vehicle?.registrationNumber ?? null,
    vehicleMakeModel: [b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(" ") || null,
    vehicleCapacityTons: b.vehicle?.capacityTons ?? null,
    vehicleBodyType: b.vehicle?.bodyType ?? null,
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

  const { data, error } = await actorResult.supabase.rpc("portal_auction_bids_v1", {
    p_request_id: requestId,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_auction_bids_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Auction not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to fetch bids" },
      { status: 500 },
    );
  }

  const result = (data ?? { bids: [] }) as { bids: RawBid[] };
  return NextResponse.json({
    ok: true,
    data: { bids: (result.bids ?? []).map(normalizeBid) },
  });
}
