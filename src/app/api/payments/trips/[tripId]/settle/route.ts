import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  advanceAmount: z.number().positive().optional(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

const MESSAGES: Record<string, string> = {
  invalid_advance_amount: "Enter a valid advance amount (not more than the driver's amount)",
  no_final_amount_due: "That advance leaves no final amount due",
  no_pending_payments: "Nothing pending to settle for this trip",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { tripId } = await params;
  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(json ?? {});
  const input = parsed.success ? parsed.data : {};

  const { error } = await actorResult.supabase.rpc("portal_trip_settle_payments_v1", {
    p_trip_id: tripId,
    p_advance_amount: input.advanceAmount ?? null,
    p_reference: input.reference ?? null,
    p_notes: input.notes ?? null,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json({ ok: false, message: "Missing RPC: portal_trip_settle_payments_v1" }, { status: 500 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Trip not found" }, { status: 404 });
    }
    const key = Object.keys(MESSAGES).find((k) => (error.message ?? "").includes(k));
    if (key) return NextResponse.json({ ok: false, message: MESSAGES[key] }, { status: 400 });
    return NextResponse.json({ ok: false, message: error.message ?? "Unable to settle payments" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { settled: true } });
}
