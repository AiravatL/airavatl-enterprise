import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (v != null ? Number(v) : null);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { tripId } = await params;
  if (!tripId) {
    return NextResponse.json({ ok: false, message: "tripId is required" }, { status: 400 });
  }
  const sb = actorResult.supabase;

  const [detailRes, paymentsRes, holdingRes] = await Promise.all([
    sb.rpc("portal_trip_detail_v1", { p_trip_id: tripId } as never),
    sb.rpc("portal_trip_payments_list_v1", { p_trip_id: tripId } as never),
    sb.rpc("portal_trip_list_holding_charges_v1", { p_trip_id: tripId } as never),
  ]);

  for (const r of [detailRes, paymentsRes, holdingRes]) {
    if (r.error) {
      if (isMissingRpcError(r.error)) {
        return NextResponse.json({ ok: false, message: "Missing trip-ops RPC" }, { status: 500 });
      }
      if (r.error.code === "42501" || r.error.code === "P0002") {
        return NextResponse.json({ ok: false, message: "Trip not found" }, { status: 404 });
      }
      return NextResponse.json(
        { ok: false, message: r.error.message ?? "Unable to load trip operations" },
        { status: 500 },
      );
    }
  }

  const detail = (detailRes.data ?? null) as { trip: Record<string, unknown>; proofs: Array<Record<string, unknown>> } | null;
  if (!detail?.trip) {
    return NextResponse.json({ ok: false, message: "Trip not found" }, { status: 404 });
  }
  const t = detail.trip;
  const payments = (paymentsRes.data ?? { payments: [] }) as { payments: Array<Record<string, unknown>> };
  const holding = (holdingRes.data ?? { entries: [], driver_total: 0, consigner_total: 0 }) as {
    entries: Array<Record<string, unknown>>;
    driver_total: number;
    consigner_total: number;
  };

  return NextResponse.json({
    ok: true,
    data: {
      isEnterprise: t.is_enterprise === true,
      status: t.status as string,
      tripNumber: (t.trip_number as string) ?? "",
      driverBidAmount: num(t.driver_bid_amount),
      customerAmount: num(t.customer_amount),
      advanceDriverAmount: num(t.advance_driver_amount),
      advancePaidAt: (t.advance_paid_at as string | null) ?? null,
      finalDriverAmount: num(t.final_driver_amount),
      finalPaidAt: (t.final_paid_at as string | null) ?? null,
      holdingDriverTotal: Number(holding.driver_total ?? 0),
      holdingConsignerTotal: Number(holding.consigner_total ?? 0),
      proofs: (detail.proofs ?? []).map((p) => ({
        id: p.id as string,
        proofType: p.proof_type as string,
        objectKey: (p.object_key as string | null) ?? null,
        fileName: (p.file_name as string | null) ?? null,
        reviewStatus: (p.review_status as string | null) ?? null,
        rejectionReason: (p.rejection_reason as string | null) ?? null,
        createdAt: p.created_at as string,
      })),
      payments: (payments.payments ?? []).map((p) => ({
        id: p.id as string,
        type: p.type as string,
        amount: Number(p.amount ?? 0),
        status: p.status as string,
        method: p.method as string,
        reference: (p.reference as string | null) ?? null,
        notes: (p.notes as string | null) ?? null,
        proofObjectKey: (p.proof_object_key as string | null) ?? null,
        completedAt: (p.completed_at as string | null) ?? null,
        createdAt: p.created_at as string,
      })),
      holdingCharges: (holding.entries ?? []).map((c) => ({
        id: c.id as string,
        driverAmount: Number(c.driver_amount ?? 0),
        consignerAmount: Number(c.consigner_amount ?? 0),
        note: (c.note as string | null) ?? null,
        createdAt: c.created_at as string,
      })),
    },
  });
}
