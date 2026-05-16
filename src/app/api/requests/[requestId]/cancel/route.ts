import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ ok: false, message: "requestId is required" }, { status: 400 });
  }

  const parsed = cancelSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid request body" }, { status: 400 });
  }

  const { error } = await actorResult.supabase.rpc(
    "portal_trip_request_cancel_v1",
    {
      p_id: requestId,
      p_reason: parsed.data.reason ?? null,
    } as never,
  );

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_trip_request_cancel_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    if (error.code === "P0002" || (error.message ?? "").includes("not_found")) {
      return NextResponse.json({ ok: false, message: "Request not found" }, { status: 404 });
    }
    if ((error.message ?? "").includes("not_cancellable")) {
      return NextResponse.json(
        { ok: false, message: "Only pending requests can be cancelled" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to cancel request" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data: { id: requestId, status: "cancelled" } });
}
