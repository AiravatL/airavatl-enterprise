import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  scope: z.enum(["active", "history", "all"]).default("active"),
  search: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

interface PortalTripRow {
  trip_id: string;
  trip_number: string;
  status: string;
  request_number: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  pickup_formatted_address: string | null;
  delivery_formatted_address: string | null;
  vehicle_type: string | null;
  consignment_date: string | null;
  customer_amount: number | string | null;
  eta_minutes: number | null;
  eta_distance_remaining_km: number | string | null;
  delivery_completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RpcResult {
  total: number;
  limit: number;
  offset: number;
  items: PortalTripRow[];
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(row: PortalTripRow) {
  return {
    tripId: row.trip_id,
    tripNumber: row.trip_number,
    status: row.status,
    requestNumber: row.request_number,
    pickupCity: row.pickup_city,
    pickupState: row.pickup_state,
    deliveryCity: row.delivery_city,
    deliveryState: row.delivery_state,
    pickupAddress: row.pickup_formatted_address,
    deliveryAddress: row.delivery_formatted_address,
    vehicleType: row.vehicle_type,
    consignmentDate: row.consignment_date,
    customerAmount: toNumber(row.customer_amount),
    etaMinutes: row.eta_minutes,
    etaDistanceRemainingKm: toNumber(row.eta_distance_remaining_km),
    deliveryCompletedAt: row.delivery_completed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    scope: searchParams.get("scope") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid query parameters" },
      { status: 400 },
    );
  }

  const { scope, search, limit, offset } = parsed.data;

  const { data, error } = await actorResult.supabase.rpc("portal_trip_list_v1", {
    p_scope: scope,
    p_search: search ?? null,
    p_limit: limit,
    p_offset: offset,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_trip_list_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to fetch trips" },
      { status: 500 },
    );
  }

  const result = (data ?? { total: 0, limit, offset, items: [] }) as RpcResult;
  return NextResponse.json({
    ok: true,
    data: {
      total: result.total ?? 0,
      limit: result.limit ?? limit,
      offset: result.offset ?? offset,
      items: (result.items ?? []).map(normalize),
    },
  });
}
