import type { TripStatus } from "@/lib/api/portal-trips";

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  pending: "Pending",
  waiting_driver_acceptance: "Awaiting driver",
  driver_assigned: "Driver assigned",
  en_route_to_pickup: "Heading to pickup",
  at_pickup: "At pickup",
  loading: "Loading",
  waiting_for_advance: "Awaiting advance",
  in_transit: "In transit",
  at_delivery: "At delivery",
  unloading: "Unloading",
  waiting_for_final: "Awaiting final payment",
  completed: "Completed",
  cancelled: "Cancelled",
  driver_rejected: "Driver rejected",
};

const STATUS_TONES = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  waiting_driver_acceptance: "bg-amber-50 text-amber-700 ring-amber-200",
  driver_assigned: "bg-blue-50 text-blue-700 ring-blue-200",
  en_route_to_pickup: "bg-blue-50 text-blue-700 ring-blue-200",
  at_pickup: "bg-blue-50 text-blue-700 ring-blue-200",
  loading: "bg-blue-50 text-blue-700 ring-blue-200",
  waiting_for_advance: "bg-amber-50 text-amber-700 ring-amber-200",
  in_transit: "bg-violet-50 text-violet-700 ring-violet-200",
  at_delivery: "bg-violet-50 text-violet-700 ring-violet-200",
  unloading: "bg-violet-50 text-violet-700 ring-violet-200",
  waiting_for_final: "bg-amber-50 text-amber-700 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
  driver_rejected: "bg-gray-100 text-gray-600 ring-gray-200",
} satisfies Record<TripStatus, string>;

export function tripStatusLabel(status: TripStatus | string): string {
  return TRIP_STATUS_LABELS[status as TripStatus] ?? prettify(status);
}

export function tripStatusToneClass(status: TripStatus | string): string {
  return STATUS_TONES[status as TripStatus] ?? "bg-gray-100 text-gray-600 ring-gray-200";
}

function prettify(s: string): string {
  return s
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
