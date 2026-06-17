import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ bidId: z.string().uuid() });

const ERROR_MESSAGES: Record<string, string> = {
  auction_not_found: "Auction not found",
  auction_not_in_selectable_state: "This auction isn't ready for winner selection yet",
  bid_not_found: "That bid no longer exists",
  bid_not_active: "That bid is no longer active",
  trip_creation_failed: "Couldn't create the trip — please try again",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ ok: false, message: "requestId is required" }, { status: 400 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "A valid bidId is required" }, { status: 400 });
  }

  const { data, error } = await actorResult.supabase.rpc("portal_auction_select_winner_v1", {
    p_request_id: requestId,
    p_bid_id: parsed.data.bidId,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_auction_select_winner_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Auction not found" }, { status: 404 });
    }
    const key = Object.keys(ERROR_MESSAGES).find((k) => (error.message ?? "").includes(k));
    if (key) {
      return NextResponse.json({ ok: false, message: ERROR_MESSAGES[key] }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to select winner" },
      { status: 500 },
    );
  }

  const result = data as {
    trip_id: string;
    trip_number: string;
    consigner_trip_amount: number;
  } | null;
  if (!result) {
    return NextResponse.json({ ok: false, message: "Unable to select winner" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      tripId: result.trip_id,
      tripNumber: result.trip_number,
      consignerTripAmount: Number(result.consigner_trip_amount),
    },
  });
}
