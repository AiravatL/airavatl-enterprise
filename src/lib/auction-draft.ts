import type { PlaceDetails } from "@/lib/api/maps";

// Hands off the pickup/drop chosen on the location-first home screen to the
// multi-step auction wizard. A module-level slot (consumed once) survives
// client-side navigation without leaking into URLs or server state — we only
// ever write it from a browser click handler, so it's null on the server.

export interface AuctionDraftLocations {
  pickup: PlaceDetails | null;
  delivery: PlaceDetails | null;
}

let pending: AuctionDraftLocations | null = null;

export function setDraftLocations(draft: AuctionDraftLocations): void {
  pending = draft;
}

export function takeDraftLocations(): AuctionDraftLocations | null {
  const draft = pending;
  pending = null;
  return draft;
}
