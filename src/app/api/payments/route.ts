import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const STATUS_VALUES = ["pending", "partial", "collected", "overdue", "written_off"] as const;

const querySchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

interface ReceivableRow {
  id: string;
  trip_id: string | null;
  trip_number: string | null;
  invoice_amount: number | string | null;
  amount_received: number | string | null;
  amount_outstanding: number | string | null;
  holding_amount: number | string | null;
  status: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  pickup_city: string | null;
  pickup_state: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_completed_at: string | null;
}

interface RpcResult {
  total: number;
  limit: number;
  offset: number;
  items: ReceivableRow[];
}

function num(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(row: ReceivableRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    tripNumber: row.trip_number,
    invoiceAmount: num(row.invoice_amount),
    amountReceived: num(row.amount_received),
    amountOutstanding: num(row.amount_outstanding),
    holdingAmount: num(row.holding_amount),
    status: row.status,
    dueDate: row.due_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pickupCity: row.pickup_city,
    pickupState: row.pickup_state,
    deliveryCity: row.delivery_city,
    deliveryState: row.delivery_state,
    deliveryCompletedAt: row.delivery_completed_at,
  };
}

export async function GET(request: Request) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid query parameters" },
      { status: 400 },
    );
  }

  const { status, limit, offset } = parsed.data;

  const { data, error } = await actorResult.supabase.rpc("portal_receivables_list_v1", {
    p_status: status ?? null,
    p_limit: limit,
    p_offset: offset,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_receivables_list_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to load receivables" },
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
