import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import {
  buildR2WorkerHeaders,
  getR2WorkerConfig,
  type WorkerPresignGetResponse,
} from "@/lib/uploads/r2-worker";

export const dynamic = "force-dynamic";

interface Body {
  objectKey?: unknown;
  tripId?: unknown;
}

export async function POST(request: Request) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const body = (await request.json().catch(() => null)) as Body | null;
  const objectKey = typeof body?.objectKey === "string" ? body.objectKey.trim() : "";
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";

  if (!objectKey) {
    return NextResponse.json({ ok: false, message: "objectKey is required" }, { status: 400 });
  }
  if (!tripId) {
    return NextResponse.json({ ok: false, message: "tripId is required" }, { status: 400 });
  }

  // Verify the requested object actually belongs to a trip the caller can see.
  // portal_trip_detail_v1 already gates by customer_id; if it returns the trip,
  // the caller owns it and can request signed URLs for any of its docs.
  const { data: tripData, error: tripError } = await actorResult.supabase.rpc(
    "portal_trip_detail_v1",
    { p_trip_id: tripId } as never,
  );

  if (tripError || !tripData) {
    return NextResponse.json({ ok: false, message: "Trip not found" }, { status: 404 });
  }

  // Defense in depth: object_key must be one of the trip's known docs.
  const allowed = collectAllowedKeys(tripData as Record<string, unknown>);
  if (!allowed.has(objectKey)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const workerConfig = await getR2WorkerConfig();
  const { data: sessionData } = await actorResult.supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

  if (!workerConfig) {
    return NextResponse.json({ ok: false, message: "R2 worker not configured" }, { status: 500 });
  }
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "No session token" }, { status: 500 });
  }

  const response = await fetch(`${workerConfig.baseUrl}/presign/get`, {
    method: "POST",
    headers: buildR2WorkerHeaders(accessToken),
    body: JSON.stringify({ objectKey }),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return NextResponse.json(
      { ok: false, message: "Unable to reach R2 worker" },
      { status: 502 },
    );
  }

  const payload = (await response.json().catch(() => null)) as WorkerPresignGetResponse | null;
  const viewUrl = payload?.view_url ?? payload?.download_url ?? null;
  if (!response.ok || !viewUrl) {
    return NextResponse.json(
      { ok: false, message: payload?.error || "Unable to generate view URL" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: { viewUrl, expiresIn: payload?.expires_in ?? null },
  });
}

function collectAllowedKeys(rpcResult: Record<string, unknown>): Set<string> {
  const keys = new Set<string>();
  const trip = rpcResult.trip as Record<string, unknown> | undefined;
  if (trip) {
    pushIfString(keys, trip.eway_bill_object_key);
    pushIfString(keys, trip.pod_object_key);
  }
  const proofs = rpcResult.proofs as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(proofs)) {
    for (const p of proofs) {
      pushIfString(keys, p.object_key);
    }
  }
  return keys;
}

function pushIfString(set: Set<string>, value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) set.add(value.trim());
}
