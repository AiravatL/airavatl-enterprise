"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { LiveTrackingMap } from "@/components/trip-detail/live-tracking-map.client";
import { SignedDocPreview } from "@/components/trip-detail/signed-doc-preview";
import { getTrip, type PortalTripDetail, type TripStatus } from "@/lib/api/portal-trips";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { tripStatusLabel } from "@/lib/format/trip-status";
import { PageShell } from "../../_components/page-shell";

const HISTORY_STATUSES: TripStatus[] = ["completed", "cancelled", "driver_rejected"];
const ACTIVE_REFETCH_MS = 20_000;
const HISTORY_REFETCH_MS = 5 * 60_000;

interface Props {
  tripId: string;
}

export function TripDetailView({ tripId }: Props) {
  const query = useQuery({
    queryKey: ["portal-trip", tripId] as const,
    queryFn: () => getTrip(tripId),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (!status) return ACTIVE_REFETCH_MS;
      return HISTORY_STATUSES.includes(status) ? HISTORY_REFETCH_MS : ACTIVE_REFETCH_MS;
    },
    refetchIntervalInBackground: false,
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PageShell title="Trip">
        <BackLink />
        <Card className="mt-3">
          <CardContent className="py-12 text-center text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : "Unable to load trip"}
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const trip = query.data;
  const isBackgroundRefreshing = query.isFetching && !query.isLoading;

  return (
    <div className="w-full px-4 py-4 sm:px-6 sm:py-5 space-y-3">
      {/* Compact hero row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Link
            href="/active-trips"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold tracking-tight text-gray-900">
            {trip.tripNumber}
          </h1>
          <TripStatusBadge status={trip.status} />
          <span className="ml-1 text-gray-300">·</span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
            <MapPin className="size-3 text-gray-400" />
            <span className="font-medium">{trip.pickup.city ?? "—"}</span>
            <span className="text-gray-400">→</span>
            <span className="font-medium">{trip.delivery.city ?? "—"}</span>
            {trip.estimatedDistanceKm != null ? (
              <span className="text-gray-400">· {Math.round(trip.estimatedDistanceKm)} km</span>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          title={isBackgroundRefreshing ? "Updating…" : "Refresh"}
          aria-label="Refresh"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <RefreshCw className={`size-3.5 ${isBackgroundRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Row 1: 12-col grid — Map (6) + Route (3) + Documents (3) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <MapCard trip={trip} />
        <RouteCard trip={trip} />
        <DocumentsCard trip={trip} />
      </div>

      {/* Row 2: 12-col — Cargo & Vehicle (3) + Timeline (9) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <CargoVehicleCard trip={trip} />
        <TimelineCard trip={trip} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/active-trips"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> Back to trips
    </Link>
  );
}

// ─── Map (col-span-6) ───────────────────────────────────────────────────────
function MapCard({ trip }: { trip: PortalTripDetail }) {
  const { pickup, delivery, tracking, routePolyline, status } = trip;
  const isHistory = HISTORY_STATUSES.includes(status);
  const hasLive = !!tracking.lastUpdatedAt && !isHistory;

  return (
    <Card className="flex flex-col lg:col-span-6">
      <CardContent className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Navigation className="size-3.5 text-gray-500" />
            {hasLive ? "Live tracking" : "Trip route"}
          </div>
          {tracking.lat != null && tracking.lng != null ? (
            <a
              href={`https://www.google.com/maps?q=${tracking.lat},${tracking.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
            >
              Open in Maps <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
        <LiveTrackingMap
          pickup={{ lat: pickup.lat, lng: pickup.lng }}
          delivery={{ lat: delivery.lat, lng: delivery.lng }}
          driver={{ lat: tracking.lat, lng: tracking.lng }}
          routePolyline={routePolyline}
          className="min-h-[320px] flex-1"
        />
        {!isHistory ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Stat label="ETA" value={tracking.etaMinutes != null ? `${tracking.etaMinutes} min` : "—"} />
            <Stat
              label="Distance left"
              value={
                tracking.etaDistanceRemainingKm != null
                  ? `${tracking.etaDistanceRemainingKm.toFixed(1)} km`
                  : "—"
              }
            />
            <Stat
              label="Updated"
              value={tracking.lastUpdatedAt ? formatDateTime(tracking.lastUpdatedAt) : "—"}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Route (col-span-3) ─────────────────────────────────────────────────────
function RouteCard({ trip }: { trip: PortalTripDetail }) {
  return (
    <Card className="lg:col-span-3">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <MapPin className="size-3.5 text-gray-500" />
          Route
        </div>
        <div className="flex items-start gap-2.5">
          <div className="mt-1 flex flex-col items-center">
            <span className="size-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            <span className="my-0.5 h-8 w-px bg-gray-200" />
            <span className="size-2.5 rounded-full bg-red-500 ring-2 ring-red-100" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-[10px] font-medium uppercase text-gray-400">Pickup</p>
              <p className="text-xs font-medium text-gray-900">
                {[trip.pickup.city, trip.pickup.state].filter(Boolean).join(", ") || "—"}
              </p>
              {trip.pickup.address ? (
                <p className="text-[11px] leading-snug text-gray-500">{trip.pickup.address}</p>
              ) : null}
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-gray-400">Delivery</p>
              <p className="text-xs font-medium text-gray-900">
                {[trip.delivery.city, trip.delivery.state].filter(Boolean).join(", ") || "—"}
              </p>
              {trip.delivery.address ? (
                <p className="text-[11px] leading-snug text-gray-500">{trip.delivery.address}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-2 text-xs">
          <Chip label="Schedule" value={formatDate(trip.consignmentDate)} />
          <Chip
            label="Duration"
            value={
              trip.estimatedDurationMinutes != null
                ? formatHours(trip.estimatedDurationMinutes)
                : "—"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Documents (col-span-3) ─────────────────────────────────────────────────
function DocumentsCard({ trip }: { trip: PortalTripDetail }) {
  const items = collectDocs(trip);

  return (
    <Card className="lg:col-span-3">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <FileText className="size-3.5 text-gray-500" />
          Documents
        </div>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center">
            <FileText className="mx-auto size-5 text-gray-300" />
            <p className="mt-1 text-[11px] text-muted-foreground">No documents yet</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50/60 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900">{item.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {item.hint ?? formatDate(item.uploadedAt)}
                  </p>
                </div>
                {item.objectKey ? (
                  <SignedDocPreview tripId={trip.tripId} objectKey={item.objectKey} label={item.label} />
                ) : (
                  <span className="text-[10px] text-muted-foreground">{item.note ?? "Pending"}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Cargo & Vehicle (col-span-3) ───────────────────────────────────────────
function CargoVehicleCard({ trip }: { trip: PortalTripDetail }) {
  const { cargo, vehicle } = trip;

  return (
    <Card className="lg:col-span-3">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <Package className="size-3.5 text-gray-500" />
          Cargo &amp; Vehicle
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Chip
            label="Vehicle"
            value={vehicle.registrationNumber ?? prettify(cargo.vehicleTypeRequired) ?? "—"}
          />
          <Chip
            label="Cargo"
            value={
              cargo.weightKg != null
                ? `${cargo.weightKg.toLocaleString()} kg`
                : prettify(cargo.type) ?? "—"
            }
          />
          <Chip label="Amount" value={formatCurrency(trip.customerAmount)} />
          {cargo.type ? <Chip label="Type" value={prettify(cargo.type) ?? "—"} /> : null}
        </div>
        {(vehicle.make || vehicle.model || vehicle.bodyType) && (
          <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-600">
            <span className="text-gray-400">Vehicle · </span>
            {[vehicle.make, vehicle.model, vehicle.bodyType].filter(Boolean).join(" · ")}
          </p>
        )}
        {cargo.description ? (
          <p className="mt-1 text-[11px] text-gray-600">
            <span className="text-gray-400">Description · </span>
            {cargo.description}
          </p>
        ) : null}
        {cargo.specialInstructions ? (
          <p className="mt-1 text-[11px] text-gray-600">
            <span className="text-gray-400">Instructions · </span>
            {cargo.specialInstructions}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Timeline (col-span-9) ──────────────────────────────────────────────────
const TIMELINE_STEPS: { status: TripStatus; field: keyof PortalTripDetail["timeline"] }[] = [
  { status: "waiting_driver_acceptance", field: "createdAt" },
  { status: "driver_assigned", field: "driverAcceptedAt" },
  { status: "en_route_to_pickup", field: "enRouteToPickupAt" },
  { status: "at_pickup", field: "arrivedAtPickupAt" },
  { status: "loading", field: "pickupCompletedAt" },
  { status: "in_transit", field: "inTransitAt" },
  { status: "at_delivery", field: "arrivedAtDeliveryAt" },
  { status: "completed", field: "deliveryCompletedAt" },
];

const STATUS_ORDER: Record<TripStatus, number> = {
  pending: 0,
  waiting_driver_acceptance: 0,
  driver_assigned: 1,
  en_route_to_pickup: 2,
  at_pickup: 3,
  loading: 4,
  waiting_for_advance: 4,
  in_transit: 5,
  at_delivery: 6,
  unloading: 6,
  waiting_for_final: 7,
  completed: 7,
  cancelled: -1,
  driver_rejected: -1,
};

function TimelineCard({ trip }: { trip: PortalTripDetail }) {
  const t = trip.timeline;

  if (t.cancelledAt || t.driverRejectedAt) {
    const cancelled = !!t.cancelledAt;
    return (
      <Card className="lg:col-span-9">
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Clock className="size-3.5 text-gray-500" />
            Timeline
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800">
              {cancelled ? "Trip cancelled" : "Driver rejected"}
            </p>
            <p className="mt-0.5 text-[11px] text-red-700">
              {formatDateTime(cancelled ? t.cancelledAt : t.driverRejectedAt)}
            </p>
            {(cancelled ? t.cancelledReason : t.driverRejectionReason) ? (
              <p className="mt-1 text-xs text-red-700">
                {cancelled ? t.cancelledReason : t.driverRejectionReason}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentIndex = STATUS_ORDER[trip.status] ?? 0;

  return (
    <Card className="lg:col-span-9">
      <CardContent className="p-3">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <Clock className="size-3.5 text-gray-500" />
          Timeline
        </div>

        {/* Horizontal stepper on lg+, vertical on small screens */}
        <ol className="hidden items-start lg:flex">
          {TIMELINE_STEPS.map((step, idx) => {
            const isCurrent = idx === currentIndex;
            const isDone = idx <= currentIndex;
            const isLast = idx === TIMELINE_STEPS.length - 1;
            const timestamp = t[step.field] as string | null;
            return (
              <li key={step.status} className="flex flex-1 items-start">
                <div className="flex w-full flex-col items-center text-center">
                  <span
                    className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                      isCurrent
                        ? "bg-primary text-white ring-4 ring-primary/15"
                        : isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="size-4" /> : (
                      <span className="size-2 rounded-full bg-gray-400" />
                    )}
                  </span>
                  <p
                    className={`mt-1.5 text-[11px] font-medium leading-tight ${
                      isCurrent ? "text-primary" : isDone ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {tripStatusLabel(step.status)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {timestamp ? formatDateTime(timestamp) : isDone ? "" : "Pending"}
                  </p>
                </div>
                {!isLast ? (
                  <span
                    className={`mt-3 h-px flex-1 ${
                      idx < currentIndex ? "bg-emerald-300" : "bg-gray-200"
                    }`}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* Vertical fallback */}
        <ol className="lg:hidden">
          {TIMELINE_STEPS.map((step, idx) => {
            const isCurrent = idx === currentIndex;
            const isDone = idx <= currentIndex;
            const isLast = idx === TIMELINE_STEPS.length - 1;
            const timestamp = t[step.field] as string | null;
            return (
              <li key={step.status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full ${
                      isCurrent
                        ? "bg-primary text-white ring-4 ring-primary/15"
                        : isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="size-3.5" /> : (
                      <span className="size-2 rounded-full bg-gray-400" />
                    )}
                  </span>
                  {!isLast ? (
                    <span
                      className={`mt-1 w-px flex-1 min-h-[20px] ${
                        idx < currentIndex ? "bg-emerald-300" : "bg-gray-200"
                      }`}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-3">
                  <p
                    className={`text-sm font-medium ${
                      isCurrent ? "text-primary" : isDone ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {tripStatusLabel(step.status)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {timestamp ? formatDateTime(timestamp) : isDone ? "" : "Pending"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-1.5 text-center">
      <p className="text-[9px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-[11px] font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-1.5">
      <p className="text-[10px] uppercase text-gray-400">{label}</p>
      <p className="text-xs font-medium text-gray-900 truncate">{value}</p>
    </div>
  );
}

interface DocumentItem {
  key: string;
  label: string;
  hint: string | null;
  uploadedAt: string | null;
  objectKey: string | null;
  note?: string;
}

function collectDocs(trip: PortalTripDetail): DocumentItem[] {
  const out: DocumentItem[] = [];
  const { documents } = trip;

  if (documents.ewayBill.objectKey) {
    out.push({
      key: "eway-bill",
      label: "E-Way Bill",
      hint: documents.ewayBill.number ?? null,
      uploadedAt: documents.ewayBill.uploadedAt,
      objectKey: documents.ewayBill.objectKey,
    });
  } else if (documents.ewayBill.skipped) {
    out.push({
      key: "eway-bill",
      label: "E-Way Bill",
      hint: "Marked not required",
      uploadedAt: null,
      objectKey: null,
      note: "Skipped",
    });
  }

  const proofTypeLabel: Record<string, string> = {
    loading: "Loading proof",
    unloading: "Unloading proof",
    pod: "Proof of Delivery",
  };

  for (const proof of documents.proofs) {
    out.push({
      key: `proof-${proof.id}`,
      label: proofTypeLabel[proof.proofType] ?? prettify(proof.proofType) ?? "Trip proof",
      hint: proof.fileName,
      uploadedAt: proof.capturedAt ?? proof.createdAt,
      objectKey: proof.objectKey,
    });
  }

  return out;
}

function prettify(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function formatHours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
