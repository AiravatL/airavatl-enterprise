import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";
import { isMissingRpcError } from "@/lib/supabase/rpc";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ tripId: string }>;
}

interface PortalTripDetailRow {
  trip_id: string;
  trip_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  consignment_date: string | null;
  customer_amount: number | string | null;

  request_number: string | null;
  pickup_formatted_address: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_latitude: number | string | null;
  pickup_longitude: number | string | null;
  delivery_formatted_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_latitude: number | string | null;
  delivery_longitude: number | string | null;
  estimated_distance_km: number | string | null;
  estimated_duration_minutes: number | null;
  route_polyline: string | null;

  vehicle_type_required: string | null;
  cargo_weight_kg: number | string | null;
  cargo_description: string | null;
  cargo_type: string | null;
  special_instructions: string | null;

  vehicle_registration_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_body_type: string | null;

  driver_name: string | null;
  driver_type: string | null;

  last_driver_lat: number | string | null;
  last_driver_lng: number | string | null;
  last_tracking_update_at: string | null;
  eta_minutes: number | null;
  eta_distance_remaining_km: number | string | null;
  eta_destination_type: string | null;
  eta_calculated_at: string | null;
  approaching_delivery: boolean | null;
  approaching_delivery_at: string | null;

  eway_bill_uploaded: boolean | null;
  eway_bill_number: string | null;
  eway_bill_object_key: string | null;
  eway_bill_uploaded_at: string | null;
  eway_bill_skipped: boolean | null;
  pod_uploaded: boolean | null;
  pod_object_key: string | null;
  pod_uploaded_at: string | null;

  driver_accepted_at: string | null;
  driver_rejected_at: string | null;
  driver_rejection_reason: string | null;
  en_route_to_pickup_at: string | null;
  arrived_at_pickup_at: string | null;
  pickup_completed_at: string | null;
  in_transit_at: string | null;
  arrived_at_delivery_at: string | null;
  delivery_completed_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}

interface PortalTripProofRow {
  id: string;
  proof_type: string;
  object_key: string | null;
  thumbnail_url: string | null;
  file_name: string | null;
  captured_at: string | null;
  created_at: string;
}

interface RpcResult {
  trip: PortalTripDetailRow;
  proofs: PortalTripProofRow[];
}

function num(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(rpc: RpcResult) {
  const t = rpc.trip;
  return {
    tripId: t.trip_id,
    tripNumber: t.trip_number,
    status: t.status,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    consignmentDate: t.consignment_date,
    customerAmount: num(t.customer_amount),

    requestNumber: t.request_number,
    pickup: {
      address: t.pickup_formatted_address,
      city: t.pickup_city,
      state: t.pickup_state,
      lat: num(t.pickup_latitude),
      lng: num(t.pickup_longitude),
    },
    delivery: {
      address: t.delivery_formatted_address,
      city: t.delivery_city,
      state: t.delivery_state,
      lat: num(t.delivery_latitude),
      lng: num(t.delivery_longitude),
    },
    estimatedDistanceKm: num(t.estimated_distance_km),
    estimatedDurationMinutes: t.estimated_duration_minutes,
    routePolyline: t.route_polyline,

    cargo: {
      vehicleTypeRequired: t.vehicle_type_required,
      weightKg: num(t.cargo_weight_kg),
      description: t.cargo_description,
      type: t.cargo_type,
      specialInstructions: t.special_instructions,
    },
    vehicle: {
      registrationNumber: t.vehicle_registration_number,
      make: t.vehicle_make,
      model: t.vehicle_model,
      bodyType: t.vehicle_body_type,
    },
    driver: {
      name: t.driver_name,
      type: t.driver_type,
    },

    tracking: {
      lat: num(t.last_driver_lat),
      lng: num(t.last_driver_lng),
      lastUpdatedAt: t.last_tracking_update_at,
      etaMinutes: t.eta_minutes,
      etaDistanceRemainingKm: num(t.eta_distance_remaining_km),
      etaDestinationType: t.eta_destination_type,
      etaCalculatedAt: t.eta_calculated_at,
      approachingDelivery: t.approaching_delivery ?? false,
      approachingDeliveryAt: t.approaching_delivery_at,
    },

    documents: {
      ewayBill: {
        uploaded: t.eway_bill_uploaded ?? false,
        number: t.eway_bill_number,
        objectKey: t.eway_bill_object_key,
        uploadedAt: t.eway_bill_uploaded_at,
        skipped: t.eway_bill_skipped ?? false,
      },
      pod: {
        uploaded: t.pod_uploaded ?? false,
        objectKey: t.pod_object_key,
        uploadedAt: t.pod_uploaded_at,
      },
      proofs: (rpc.proofs ?? []).map((p) => ({
        id: p.id,
        proofType: p.proof_type,
        objectKey: p.object_key,
        thumbnailUrl: p.thumbnail_url,
        fileName: p.file_name,
        capturedAt: p.captured_at,
        createdAt: p.created_at,
      })),
    },

    timeline: {
      createdAt: t.created_at,
      driverAcceptedAt: t.driver_accepted_at,
      driverRejectedAt: t.driver_rejected_at,
      driverRejectionReason: t.driver_rejection_reason,
      enRouteToPickupAt: t.en_route_to_pickup_at,
      arrivedAtPickupAt: t.arrived_at_pickup_at,
      pickupCompletedAt: t.pickup_completed_at,
      inTransitAt: t.in_transit_at,
      arrivedAtDeliveryAt: t.arrived_at_delivery_at,
      deliveryCompletedAt: t.delivery_completed_at,
      cancelledAt: t.cancelled_at,
      cancelledReason: t.cancelled_reason,
    },
  };
}

export async function GET(_: Request, context: RouteParams) {
  const actorResult = await requirePortalActor();
  if ("error" in actorResult) return actorResult.error;

  const { tripId } = await context.params;
  if (!tripId) {
    return NextResponse.json({ ok: false, message: "tripId is required" }, { status: 400 });
  }

  const { data, error } = await actorResult.supabase.rpc("portal_trip_detail_v1", {
    p_trip_id: tripId,
  } as never);

  if (error) {
    if (isMissingRpcError(error)) {
      return NextResponse.json(
        { ok: false, message: "Missing RPC: portal_trip_detail_v1" },
        { status: 500 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    if (error.code === "P0002") {
      return NextResponse.json({ ok: false, message: "Trip not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, message: error.message ?? "Unable to load trip" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ ok: false, message: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: normalize(data as RpcResult) });
}
