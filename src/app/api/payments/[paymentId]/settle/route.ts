import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { paymentId } = await params;
  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(json ?? {});
  const input = parsed.success ? parsed.data : {};

  const { error } = await actorResult.supabase.rpc("portal_payment_settle_v1", {
    p_payment_id: paymentId,
    p_payment_reference: input.reference ?? null,
    p_notes: input.notes ?? null,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json({ ok: false, message: "Missing RPC: portal_payment_settle_v1" }, { status: 500 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Payment not found" }, { status: 404 });
    }
    if ((error.message ?? "").includes("payment_not_pending")) {
      return NextResponse.json({ ok: false, message: "This payment is already settled" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: error.message ?? "Unable to settle payment" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { settled: true } });
}
