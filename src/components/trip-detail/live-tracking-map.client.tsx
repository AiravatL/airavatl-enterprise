"use client";

import dynamic from "next/dynamic";

import type { LatLng } from "@/lib/api/portal-trips";

interface Props {
  pickup: LatLng;
  delivery: LatLng;
  driver: LatLng;
  routePolyline: string | null;
  className?: string;
}

// Leaflet relies on `window`, so the map can only render in the browser.
const MapInner = dynamic(
  () => import("./live-tracking-map").then((m) => m.LiveTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export function LiveTrackingMap(props: Props) {
  return <MapInner {...props} />;
}
