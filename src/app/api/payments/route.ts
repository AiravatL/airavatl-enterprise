import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

interface PendingRow {
  id: string;
  trip_id: string;
  trip_number: string;
  type: "advance" | "final" | "refund" | "penalty";
  amount: number | string;
  bid_amount: number | string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  pickup_city: string | null;
  delivery_city: string | null;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalize(row: PendingRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    tripNumber: row.trip_number,
    type: row.type,
    amount: num(row.amount),
    bidAmount: num(row.bid_amount),
    reference: row.reference,
    notes: row.notes,
    createdAt: row.created_at,
    pickupCity: row.pickup_city,
    deliveryCity: row.delivery_city,
  };
}

export async function GET(request: Request) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid query parameters" }, { status: 400 });
  }
  const { limit, offset } = parsed.data;

  const { data, error } = await actorResult.supabase.rpc("portal_pending_payments_list_v1", {
    p_limit: limit,
    p_offset: offset,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_pending_payments_list_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to load pending payments" },
      { status: 500 },
    );
  }

  const result = (data ?? { total: 0, total_amount: 0, limit, offset, items: [] }) as {
    total: number;
    total_amount: number | string;
    limit: number;
    offset: number;
    items: PendingRow[];
  };

  return NextResponse.json({
    ok: true,
    data: {
      total: result.total ?? 0,
      totalAmount: num(result.total_amount),
      limit: result.limit ?? limit,
      offset: result.offset ?? offset,
      items: (result.items ?? []).map(normalize),
    },
  });
}
