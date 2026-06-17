import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  proofId: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
  rejectionReason: z.string().trim().max(300).optional(),
});

const MESSAGES: Record<string, string> = {
  rejection_reason_required: "A reason is required to reject a proof",
  already_reviewed: "This proof has already been reviewed",
  proof_not_found: "Proof not found",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { tripId } = await params;
  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid request" }, { status: 400 });
  }
  if (parsed.data.action === "reject" && !parsed.data.rejectionReason) {
    return NextResponse.json({ ok: false, message: "A reason is required to reject" }, { status: 400 });
  }

  const { error } = await actorResult.supabase.rpc("portal_trip_proof_review_v1", {
    p_trip_id: tripId,
    p_proof_id: parsed.data.proofId,
    p_action: parsed.data.action,
    p_rejection_reason: parsed.data.rejectionReason ?? null,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json({ ok: false, message: "Missing RPC: portal_trip_proof_review_v1" }, { status: 500 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Proof not found" }, { status: 404 });
    }
    const key = Object.keys(MESSAGES).find((k) => (error.message ?? "").includes(k));
    if (key) return NextResponse.json({ ok: false, message: MESSAGES[key] }, { status: 400 });
    return NextResponse.json({ ok: false, message: error.message ?? "Unable to review proof" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { reviewed: true } });
}
