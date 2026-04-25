"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Box,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
  Truck,
  User,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <PageShell
      title={trip.tripNumber}
      description={
        trip.requestNumber
          ? `${trip.requestNumber} · Created ${formatDateTime(trip.createdAt)}`
          : `Created ${formatDateTime(trip.createdAt)}`
      }
      actions={
        <>
          <TripStatusBadge status={trip.status} />
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            title={isBackgroundRefreshing ? "Updating…" : "Refresh"}
            aria-label="Refresh"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <RefreshCw className={`size-4 ${isBackgroundRefreshing ? "animate-spin" : ""}`} />
          </button>
        </>
      }
    >
      <BackLink />
      <div className="mt-3 space-y-4">
        <LiveTrackingSection trip={trip} />
        <RouteSection trip={trip} />
        <CargoVehicleSection trip={trip} />
        <TimelineSection trip={trip} />
        <DocumentsSection trip={trip} />
      </div>
    </PageShell>
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

// 1. Live tracking — map + ETA strip
function LiveTrackingSection({ trip }: { trip: PortalTripDetail }) {
  const { tracking, pickup, delivery, routePolyline, status } = trip;
  const isHistory = HISTORY_STATUSES.includes(status);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Navigation className="size-4 text-primary" />
          Live tracking
        </CardTitle>
        {tracking.lastUpdatedAt ? (
          <span className="text-[11px] text-muted-foreground">
            Updated {formatDateTime(tracking.lastUpdatedAt)}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <LiveTrackingMap
          pickup={{ lat: pickup.lat, lng: pickup.lng }}
          delivery={{ lat: delivery.lat, lng: delivery.lng }}
          driver={{ lat: tracking.lat, lng: tracking.lng }}
          routePolyline={routePolyline}
          className="h-72 sm:h-80"
        />

        {!isHistory ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat
              label="ETA"
              value={tracking.etaMinutes != null ? `${tracking.etaMinutes} min` : "—"}
              hint={
                tracking.etaDestinationType
                  ? `to ${prettify(tracking.etaDestinationType)}`
                  : undefined
              }
            />
            <Stat
              label="Distance left"
              value={
                tracking.etaDistanceRemainingKm != null
                  ? `${tracking.etaDistanceRemainingKm.toFixed(1)} km`
                  : "—"
              }
            />
            <Stat
              label="Total distance"
              value={
                trip.estimatedDistanceKm != null
                  ? `${trip.estimatedDistanceKm.toFixed(0)} km`
                  : "—"
              }
            />
          </div>
        ) : null}

        {tracking.approachingDelivery && !isHistory ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="mr-1 inline size-3.5 -mt-0.5" />
            Driver is approaching the delivery location.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// 2. Route — pickup + delivery (no contact info; portal stays read-only)
function RouteSection({ trip }: { trip: PortalTripDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-primary" />
          Route
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <RoutePoint
          tone="emerald"
          label="Pickup"
          city={trip.pickup.city}
          state={trip.pickup.state}
          address={trip.pickup.address}
        />
        <div className="ml-[5px] h-4 w-px bg-gray-200" aria-hidden />
        <RoutePoint
          tone="red"
          label="Delivery"
          city={trip.delivery.city}
          state={trip.delivery.state}
          address={trip.delivery.address}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Consignment date
            </p>
            <p className="mt-0.5 text-sm text-gray-900">
              {formatDate(trip.consignmentDate)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Estimated duration
            </p>
            <p className="mt-0.5 text-sm text-gray-900">
              {trip.estimatedDurationMinutes != null
                ? formatHours(trip.estimatedDurationMinutes)
                : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RoutePoint({
  tone,
  label,
  city,
  state,
  address,
}: {
  tone: "emerald" | "red";
  label: string;
  city: string | null;
  state: string | null;
  address: string | null;
}) {
  const dot = tone === "emerald" ? "bg-emerald-500" : "bg-red-500";
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium text-gray-900">
          {[city, state].filter(Boolean).join(", ") || "—"}
        </p>
        {address ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{address}</p>
        ) : null}
      </div>
    </div>
  );
}

// 3. Cargo & Vehicle (driver name only — no contact details)
function CargoVehicleSection({ trip }: { trip: PortalTripDetail }) {
  const { cargo, vehicle, driver } = trip;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Package className="size-4 text-primary" />
          Cargo &amp; Vehicle
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Field
            icon={<Box className="size-4 text-muted-foreground" />}
            label="Cargo"
            value={cargo.description ?? prettify(cargo.type) ?? "—"}
            hint={cargo.weightKg != null ? `${cargo.weightKg} kg` : null}
          />
          {cargo.specialInstructions ? (
            <Field
              icon={<FileText className="size-4 text-muted-foreground" />}
              label="Special instructions"
              value={cargo.specialInstructions}
            />
          ) : null}
          <Field
            icon={<CalendarDays className="size-4 text-muted-foreground" />}
            label="Trip amount"
            value={formatCurrency(trip.customerAmount)}
          />
        </div>
        <div className="space-y-3">
          <Field
            icon={<Truck className="size-4 text-muted-foreground" />}
            label="Vehicle"
            value={
              vehicle.registrationNumber ?? prettify(cargo.vehicleTypeRequired) ?? "—"
            }
            hint={
              [vehicle.make, vehicle.model, vehicle.bodyType].filter(Boolean).join(" · ") ||
              prettify(cargo.vehicleTypeRequired)
            }
          />
          <Field
            icon={<User className="size-4 text-muted-foreground" />}
            label="Driver"
            value={driver.name ?? "Awaiting assignment"}
            hint={driver.type ? prettify(driver.type) : null}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// 4. Timeline — status-based stepper (modeled after ERP TripTimeline)
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

function TimelineSection({ trip }: { trip: PortalTripDetail }) {
  const t = trip.timeline;

  // Cancelled / rejected trips get a different shape.
  if (t.cancelledAt) {
    return (
      <TerminalTimeline
        events={[
          { label: "Trip created", timestamp: t.createdAt, done: true },
          {
            label: "Cancelled",
            timestamp: t.cancelledAt,
            done: true,
            tone: "red",
            detail: t.cancelledReason ?? undefined,
          },
        ]}
      />
    );
  }
  if (t.driverRejectedAt) {
    return (
      <TerminalTimeline
        events={[
          { label: "Trip created", timestamp: t.createdAt, done: true },
          {
            label: "Driver rejected",
            timestamp: t.driverRejectedAt,
            done: true,
            tone: "red",
            detail: t.driverRejectionReason ?? undefined,
          },
        ]}
      />
    );
  }

  const currentIndex = STATUS_ORDER[trip.status] ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="size-4 text-primary" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative">
          {TIMELINE_STEPS.map((step, idx) => {
            const isCurrent = idx === currentIndex;
            const isDone = idx <= currentIndex;
            const isLast = idx === TIMELINE_STEPS.length - 1;
            const timestamp = t[step.field] as string | null;

            return (
              <li key={step.status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
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
                      className={`mt-1 w-px flex-1 min-h-[24px] ${
                        idx < currentIndex ? "bg-emerald-300" : "bg-gray-200"
                      }`}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <p
                    className={`text-sm font-medium ${
                      isCurrent ? "text-primary" : isDone ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {tripStatusLabel(step.status)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
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

interface TerminalEvent {
  label: string;
  timestamp: string | null;
  done: boolean;
  tone?: "red";
  detail?: string;
}

function TerminalTimeline({ events }: { events: TerminalEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="size-4 text-primary" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {events.map((e, i) => (
            <li key={e.label} className="flex gap-3">
              <span
                className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full ${
                  e.tone === "red"
                    ? "bg-red-500 text-white"
                    : "bg-emerald-500 text-white"
                }`}
              >
                <CheckCircle2 className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{e.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {e.timestamp ? formatDateTime(e.timestamp) : ""}
                </p>
                {e.detail ? (
                  <p className="mt-0.5 text-xs text-gray-600">{e.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// 5. Documents — view in modal via signed R2 URL
function DocumentsSection({ trip }: { trip: PortalTripDetail }) {
  const items = collectDocs(trip);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileCheck className="size-4 text-primary" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-muted-foreground">
            Documents will appear here once uploaded by the driver.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.hint ?? formatDateTime(item.uploadedAt)}
                    </p>
                  </div>
                </div>
                {item.objectKey ? (
                  <SignedDocPreview
                    tripId={trip.tripId}
                    objectKey={item.objectKey}
                    label={item.label}
                  />
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {item.note ?? "Pending"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
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
      hint: "Marked as not required",
      uploadedAt: null,
      objectKey: null,
      note: "Skipped",
    });
  }

  // Map proofs by type for stable de-dup against pod_object_key.
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

// Helpers ---------------------------------------------------------------------

function Field({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-gray-900 capitalize">{value}</p>
        {hint ? (
          <p className="text-[11px] text-muted-foreground capitalize">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground capitalize">{hint}</p> : null}
    </div>
  );
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
