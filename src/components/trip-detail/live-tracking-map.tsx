"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { LatLng } from "@/lib/api/portal-trips";

interface Props {
  pickup: LatLng;
  delivery: LatLng;
  driver: LatLng;
  routePolyline: string | null;
  className?: string;
}

const PICKUP_ICON = createIcon("#16a34a"); // emerald
const DELIVERY_ICON = createIcon("#dc2626"); // red
const DRIVER_ICON = createIcon("#4c1d95"); // brand violet

export function LiveTrackingMap({
  pickup,
  delivery,
  driver,
  routePolyline,
  className,
}: Props) {
  const points = useMemo(
    () =>
      [
        pickup.lat != null && pickup.lng != null ? ([pickup.lat, pickup.lng] as [number, number]) : null,
        delivery.lat != null && delivery.lng != null
          ? ([delivery.lat, delivery.lng] as [number, number])
          : null,
        driver.lat != null && driver.lng != null ? ([driver.lat, driver.lng] as [number, number]) : null,
      ].filter(Boolean) as Array<[number, number]>,
    [pickup.lat, pickup.lng, delivery.lat, delivery.lng, driver.lat, driver.lng],
  );

  const decoded = useMemo(() => decodePolyline(routePolyline), [routePolyline]);

  const center =
    points[0] ?? ([20.5937, 78.9629] as [number, number]); // India fallback
  const zoom = points.length > 1 ? 8 : 12;

  if (points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-muted-foreground ${className ?? "h-72"}`}
      >
        Tracking will appear once the driver shares their location.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 ${className ?? "h-72"}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ background: "#f1f5f9" }}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {pickup.lat != null && pickup.lng != null ? (
          <Marker position={[pickup.lat, pickup.lng]} icon={PICKUP_ICON}>
            <Popup>Pickup</Popup>
          </Marker>
        ) : null}

        {delivery.lat != null && delivery.lng != null ? (
          <Marker position={[delivery.lat, delivery.lng]} icon={DELIVERY_ICON}>
            <Popup>Delivery</Popup>
          </Marker>
        ) : null}

        {driver.lat != null && driver.lng != null ? (
          <Marker position={[driver.lat, driver.lng]} icon={DRIVER_ICON}>
            <Popup>Driver</Popup>
          </Marker>
        ) : null}

        {decoded.length > 1 ? (
          <Polyline positions={decoded} pathOptions={{ color: "#4c1d95", weight: 4, opacity: 0.6 }} />
        ) : points.length >= 2 ? (
          <Polyline
            positions={points.slice(0, 2)}
            pathOptions={{ color: "#9ca3af", weight: 2, dashArray: "6 8" }}
          />
        ) : null}

        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const lastFitKey = useRef<string | null>(null);

  useEffect(() => {
    if (points.length === 0) return;
    const key = points.map((p) => p.join(",")).join("|");
    if (lastFitKey.current === key) return;
    lastFitKey.current = key;

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 12), { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);

  return null;
}

function createIcon(colorHex: string): L.DivIcon {
  // Inline SVG marker — avoids the default Leaflet sprite path issues in Next.js.
  const html = `
    <div style="position:relative;">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 11 16 24 16 24s16-13 16-24C32 7.16 24.84 0 16 0z" fill="${colorHex}"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: "portal-marker",
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
  });
}

// Google's encoded polyline format used in delivery_requests.route_polyline.
function decodePolyline(encoded: string | null): Array<[number, number]> {
  if (!encoded) return [];
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;

  try {
    while (index < len) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      result = 0;
      shift = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }
  } catch {
    return [];
  }
  return points;
}
