import { NextResponse } from "next/server";
import { requirePortalActor } from "@/lib/auth/server-actor";

export const dynamic = "force-dynamic";

export async function requireMapsActor() {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult;
  return { supabase: actorResult.supabase, actor: actorResult.account };
}

export function getGoogleMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY ?? null;
}

export function missingKeyResponse() {
  return NextResponse.json(
    { ok: false, message: "Google Maps API key is not configured" },
    { status: 500 },
  );
}

type MapsBucket = "places" | "place-details";

const MAPS_RATE_LIMIT_WINDOW_MS = 60_000;
const MAPS_RATE_LIMITS: Record<MapsBucket, number> = {
  places: 20,
  "place-details": 40,
};
const mapsRateLimitStore = new Map<string, number[]>();

export function enforceMapsRateLimit(actorId: string, bucket: MapsBucket) {
  const now = Date.now();
  const key = `${bucket}:${actorId}`;
  const windowStart = now - MAPS_RATE_LIMIT_WINDOW_MS;
  const current = (mapsRateLimitStore.get(key) ?? []).filter((ts) => ts > windowStart);

  if (current.length >= MAPS_RATE_LIMITS[bucket]) {
    return NextResponse.json(
      { ok: false, message: "Too many map lookups. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  current.push(now);
  mapsRateLimitStore.set(key, current);
  return null;
}
