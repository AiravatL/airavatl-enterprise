"use client";

import { useEffect, useRef } from "react";
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

const PICKUP_ICON = L.divIcon({
  html:
    '<div style="width:14px;height:14px;border-radius:50%;background:#10b981;' +
    'border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const DELIVERY_ICON = L.divIcon({
  html:
    '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;' +
    'border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const DRIVER_ICON = L.divIcon({
  html:
    '<div style="width:32px;height:32px;border-radius:50%;background:#2563eb;' +
    'border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);' +
    'display:flex;align-items:center;justify-content:center">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>' +
    '<circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>' +
    "</div>",
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export function LiveTrackingMap({
  pickup,
  delivery,
  driver,
  routePolyline,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);

  // Initialize once. Pickup/delivery don't change for a trip, so they stay set.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (
      pickup.lat == null ||
      pickup.lng == null ||
      delivery.lat == null ||
      delivery.lng == null
    ) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    L.marker([pickup.lat, pickup.lng], { icon: PICKUP_ICON })
      .addTo(map)
      .bindTooltip("Pickup", { direction: "top", offset: [0, -8] });

    L.marker([delivery.lat, delivery.lng], { icon: DELIVERY_ICON })
      .addTo(map)
      .bindTooltip("Delivery", { direction: "top", offset: [0, -8] });

    const decoded = decodePolyline(routePolyline);
    if (decoded.length > 1) {
      L.polyline(decoded, { color: "#4c1d95", weight: 3.5, opacity: 0.55 }).addTo(map);
    } else {
      L.polyline(
        [
          [pickup.lat, pickup.lng],
          [delivery.lat, delivery.lng],
        ],
        { color: "#6366f1", weight: 3, opacity: 0.5, dashArray: "8 6" },
      ).addTo(map);
    }

    const bounds = L.latLngBounds([
      [pickup.lat, pickup.lng],
      [delivery.lat, delivery.lng],
    ]);
    if (driver.lat != null && driver.lng != null) {
      bounds.extend([driver.lat, driver.lng]);
    }
    map.fitBounds(bounds, { padding: [40, 40] });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      driverMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move driver marker as new locations arrive — no re-init.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (driver.lat == null || driver.lng == null) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([driver.lat, driver.lng]);
    } else {
      driverMarkerRef.current = L.marker([driver.lat, driver.lng], { icon: DRIVER_ICON })
        .addTo(map)
        .bindTooltip("Driver", { direction: "top", offset: [0, -18] });
    }
  }, [driver.lat, driver.lng]);

  if (
    pickup.lat == null ||
    pickup.lng == null ||
    delivery.lat == null ||
    delivery.lng == null
  ) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-muted-foreground ${className ?? "h-full"}`}
      >
        Tracking will appear once the trip is on the road.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        zIndex: 0,
        width: "100%",
        minHeight: 280,
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
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
