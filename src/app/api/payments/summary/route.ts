import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

interface RpcResult {
  total_outstanding: number | string;
  total_overdue: number | string;
  total_paid: number | string;
  total_invoiced: number | string;
  count_outstanding: number;
  count_overdue: number;
}

function num(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { data, error } = await actorResult.supabase.rpc(
    "portal_receivables_summary_v1",
    {} as never,
  );

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_receivables_summary_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to load summary" },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as Partial<RpcResult>;
  return NextResponse.json({
    ok: true,
    data: {
      totalOutstanding: num(result.total_outstanding),
      totalOverdue: num(result.total_overdue),
      totalPaid: num(result.total_paid),
      totalInvoiced: num(result.total_invoiced),
      countOutstanding: Number(result.count_outstanding ?? 0),
      countOverdue: Number(result.count_overdue ?? 0),
    },
  });
}
