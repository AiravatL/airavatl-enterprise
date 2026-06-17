import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  charge_not_found: "Charge not found",
  final_already_paid: "The final payment is already settled",
  final_payment_already_recorded: "The final payment is already recorded",
};

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; chargeId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { chargeId } = await params;

  const { error } = await actorResult.supabase.rpc("portal_trip_delete_holding_charge_v1", {
    p_charge_id: chargeId,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json({ ok: false, message: "Missing RPC: portal_trip_delete_holding_charge_v1" }, { status: 500 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Charge not found" }, { status: 404 });
    }
    const key = Object.keys(MESSAGES).find((k) => (error.message ?? "").includes(k));
    if (key) return NextResponse.json({ ok: false, message: MESSAGES[key] }, { status: 400 });
    return NextResponse.json({ ok: false, message: error.message ?? "Unable to delete charge" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { deleted: true } });
}
