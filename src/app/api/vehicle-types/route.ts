import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

function normalize(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    code: (row.code as string) ?? "",
    name: (row.name as string) ?? "",
    capacityTons: row.capacity_tons != null ? Number(row.capacity_tons) : null,
    bodyType: (row.body_type as string | null) ?? null,
    lengthFeet: row.length_feet != null ? Number(row.length_feet) : null,
    wheelCount: row.wheel_count != null ? Number(row.wheel_count) : null,
  };
}

export async function GET() {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { data, error } = await actorResult.supabase.rpc(
    "portal_list_vehicle_types_v1",
    {} as never,
  );

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_list_vehicle_types_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to fetch vehicle types" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return NextResponse.json({ ok: true, data: rows.map(normalize) });
}
