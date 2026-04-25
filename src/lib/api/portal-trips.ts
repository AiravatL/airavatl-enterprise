import { apiRequest } from "@/lib/api/http";

export type TripScope = "active" | "history" | "all";

export type TripStatus =
  | "pending"
  | "waiting_driver_acceptance"
  | "driver_assigned"
  | "en_route_to_pickup"
  | "at_pickup"
  | "loading"
  | "waiting_for_advance"
  | "in_transit"
  | "at_delivery"
  | "unloading"
  | "waiting_for_final"
  | "completed"
  | "cancelled"
  | "driver_rejected";

export interface PortalTripRow {
  tripId: string;
  tripNumber: string;
  status: TripStatus;
  requestNumber: string | null;
  pickupCity: string | null;
  pickupState: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  vehicleType: string | null;
  consignmentDate: string | null;
  customerAmount: number | null;
  etaMinutes: number | null;
  etaDistanceRemainingKm: number | null;
  deliveryCompletedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortalTripListResponse {
  total: number;
  limit: number;
  offset: number;
  items: PortalTripRow[];
}

export interface ListTripsParams {
  scope?: TripScope;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LatLng {
  lat: number | null;
  lng: number | null;
}

export interface RouteEndpoint extends LatLng {
  address: string | null;
  city: string | null;
  state: string | null;
}

export interface PortalTripDetail {
  tripId: string;
  tripNumber: string;
  status: TripStatus;
  createdAt: string;
  updatedAt: string;
  consignmentDate: string | null;
  customerAmount: number | null;

  requestNumber: string | null;
  pickup: RouteEndpoint;
  delivery: RouteEndpoint;
  estimatedDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  routePolyline: string | null;

  cargo: {
    vehicleTypeRequired: string | null;
    weightKg: number | null;
    description: string | null;
    type: string | null;
    specialInstructions: string | null;
  };
  vehicle: {
    registrationNumber: string | null;
    make: string | null;
    model: string | null;
    bodyType: string | null;
  };

  tracking: {
    lat: number | null;
    lng: number | null;
    lastUpdatedAt: string | null;
    etaMinutes: number | null;
    etaDistanceRemainingKm: number | null;
    etaDestinationType: string | null;
    etaCalculatedAt: string | null;
    approachingDelivery: boolean;
    approachingDeliveryAt: string | null;
  };

  documents: {
    ewayBill: {
      uploaded: boolean;
      number: string | null;
      objectKey: string | null;
      uploadedAt: string | null;
      skipped: boolean;
    };
    pod: {
      uploaded: boolean;
      objectKey: string | null;
      uploadedAt: string | null;
    };
    proofs: Array<{
      id: string;
      proofType: string;
      objectKey: string | null;
      thumbnailUrl: string | null;
      fileName: string | null;
      capturedAt: string | null;
      createdAt: string;
    }>;
  };

  timeline: {
    createdAt: string;
    driverAcceptedAt: string | null;
    driverRejectedAt: string | null;
    driverRejectionReason: string | null;
    enRouteToPickupAt: string | null;
    arrivedAtPickupAt: string | null;
    pickupCompletedAt: string | null;
    inTransitAt: string | null;
    arrivedAtDeliveryAt: string | null;
    deliveryCompletedAt: string | null;
    cancelledAt: string | null;
    cancelledReason: string | null;
  };
}

export async function getTrip(tripId: string): Promise<PortalTripDetail> {
  return apiRequest<PortalTripDetail>(`/api/trips/${tripId}`, {
    method: "GET",
    cache: "no-store",
  });
}

export interface ProofViewUrl {
  viewUrl: string;
  expiresIn: number | null;
}

export async function getTripProofViewUrl(
  tripId: string,
  objectKey: string,
): Promise<ProofViewUrl> {
  return apiRequest<ProofViewUrl>("/api/trips/proof-view-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tripId, objectKey }),
  });
}

export async function listTrips(params: ListTripsParams = {}): Promise<PortalTripListResponse> {
  const search = new URLSearchParams();
  if (params.scope) search.set("scope", params.scope);
  if (params.search) search.set("search", params.search);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiRequest<PortalTripListResponse>(
    `/api/trips${qs ? `?${qs}` : ""}`,
    { method: "GET", cache: "no-store" },
  );
}
