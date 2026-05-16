import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

function normalizeDetail(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    requestNumber: row.request_number as string,
    status: row.status as string,
    source: row.source as string,
    pickupAddress: (row.pickup_address as string) ?? "",
    pickupCity: (row.pickup_city as string | null) ?? null,
    pickupState: (row.pickup_state as string | null) ?? null,
    pickupContactName: (row.pickup_contact_name as string | null) ?? null,
    pickupContactPhone: (row.pickup_contact_phone as string | null) ?? null,
    deliveryAddress: (row.delivery_address as string) ?? "",
    deliveryCity: (row.delivery_city as string | null) ?? null,
    deliveryState: (row.delivery_state as string | null) ?? null,
    deliveryContactName: (row.delivery_contact_name as string | null) ?? null,
    deliveryContactPhone: (row.delivery_contact_phone as string | null) ?? null,
    cargoDescription: (row.cargo_description as string) ?? "",
    cargoWeightKg: (row.cargo_weight_kg as number | null) ?? null,
    cargoType: (row.cargo_type as string | null) ?? null,
    specialInstructions: (row.special_instructions as string | null) ?? null,
    preferredPickupAt: (row.preferred_pickup_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    cancelledReason: (row.cancelled_reason as string | null) ?? null,
    deliveryRequestId: (row.delivery_request_id as string | null) ?? null,
    linkedDeliveryRequestNumber:
      (row.linked_delivery_request_number as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
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

  const { data, error } = await actorResult.supabase.rpc(
    "portal_trip_request_detail_v1",
    { p_id: requestId } as never,
  );

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_trip_request_detail_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    if (error.code === "P0002" || (error.message ?? "").includes("not_found")) {
      return NextResponse.json({ ok: false, message: "Request not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to fetch request" },
      { status: 500 },
    );
  }

  const row = data as Record<string, unknown> | null;
  if (!row) {
    return NextResponse.json({ ok: false, message: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: normalizeDetail(row) });
}
