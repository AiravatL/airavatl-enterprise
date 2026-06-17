import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  paymentType: z.enum(["advance", "final"]),
  amount: z.number().positive().optional(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  proofObjectKey: z.string().trim().max(500).optional(),
  defer: z.boolean().optional(),
});

const MESSAGES: Record<string, string> = {
  payment_already_recorded: "This payment has already been recorded",
  invalid_advance_amount: "Enter a valid advance amount",
  advance_exceeds_bid: "Advance can't exceed the driver's amount",
  driver_bid_amount_missing: "Driver amount is missing on this trip",
  trip_not_waiting_for_advance: "The trip isn't ready for an advance payment yet",
  trip_not_waiting_for_final: "The trip isn't ready for the final payment yet",
  no_final_amount_due: "There's no final amount due",
  driver_user_not_found: "Couldn't resolve the driver for this trip",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { tripId } = await params;
  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid request" }, { status: 400 });
  }
  if (parsed.data.paymentType === "advance" && parsed.data.amount == null) {
    return NextResponse.json({ ok: false, message: "Advance amount is required" }, { status: 400 });
  }

  const { data, error } = await actorResult.supabase.rpc("portal_trip_record_payment_v1", {
    p_trip_id: tripId,
    p_payment_type: parsed.data.paymentType,
    p_amount: parsed.data.amount ?? null,
    p_payment_reference: parsed.data.reference ?? null,
    p_notes: parsed.data.notes ?? null,
    p_proof_object_key: parsed.data.proofObjectKey ?? null,
    p_defer: parsed.data.defer ?? false,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json({ ok: false, message: "Missing RPC: portal_trip_record_payment_v1" }, { status: 500 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Trip not found" }, { status: 404 });
    }
    const key = Object.keys(MESSAGES).find((k) => (error.message ?? "").includes(k));
    if (key) return NextResponse.json({ ok: false, message: MESSAGES[key] }, { status: 400 });
    return NextResponse.json({ ok: false, message: error.message ?? "Unable to record payment" }, { status: 500 });
  }

  const result = data as { amount: number; new_trip_status: string } | null;
  return NextResponse.json({
    ok: true,
    data: { amount: Number(result?.amount ?? 0), newTripStatus: result?.new_trip_status ?? "" },
  });
}
