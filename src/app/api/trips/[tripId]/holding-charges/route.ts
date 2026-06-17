import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  driverAmount: z.number().nonnegative(),
  consignerAmount: z.number().nonnegative().optional(),
  note: z.string().trim().max(300).optional(),
});

const MESSAGES: Record<string, string> = {
  amount_required: "Enter an amount",
  amount_negative: "Amount can't be negative",
  trip_terminal: "This trip is already closed",
  final_already_paid: "The final payment is already settled",
  final_payment_already_recorded: "The final payment is already recorded",
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

  const { error } = await actorResult.supabase.rpc("portal_trip_add_holding_charge_v1", {
    p_trip_id: tripId,
    p_driver_amount: parsed.data.driverAmount,
    p_consigner_amount: parsed.data.consignerAmount ?? 0,
    p_note: parsed.data.note ?? null,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json({ ok: false, message: "Missing RPC: portal_trip_add_holding_charge_v1" }, { status: 500 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Trip not found" }, { status: 404 });
    }
    const key = Object.keys(MESSAGES).find((k) => (error.message ?? "").includes(k));
    if (key) return NextResponse.json({ ok: false, message: MESSAGES[key] }, { status: 400 });
    return NextResponse.json({ ok: false, message: error.message ?? "Unable to add charge" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { added: true } });
}
