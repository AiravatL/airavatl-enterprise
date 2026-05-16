import { apiRequest } from "@/lib/api/http";

export type TripRequestStatus = "pending_review" | "converted" | "rejected" | "cancelled";
export type TripRequestSource = "enterprise_portal" | "erp_sales";

export interface PortalTripRequestRow {
  id: string;
  requestNumber: string;
  status: TripRequestStatus;
  source: TripRequestSource;
  pickupAddress: string;
  pickupCity: string | null;
  pickupState: string | null;
  deliveryAddress: string;
  deliveryCity: string | null;
  deliveryState: string | null;
  cargoDescription: string;
  preferredPickupAt: string | null;
  deliveryRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortalTripRequestDetail extends PortalTripRequestRow {
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  cargoWeightKg: number | null;
  cargoType: string | null;
  specialInstructions: string | null;
  notes: string | null;
  rejectionReason: string | null;
  cancelledReason: string | null;
  linkedDeliveryRequestNumber: string | null;
}

export interface PortalTripRequestListResponse {
  total: number;
  limit: number;
  offset: number;
  items: PortalTripRequestRow[];
}

export interface ListPortalRequestsParams {
  status?: TripRequestStatus;
  limit?: number;
  offset?: number;
}

export interface CreatePortalRequestInput {
  pickupAddress: string;
  pickupCity?: string;
  pickupState?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupPlaceId?: string;
  deliveryAddress: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryPlaceId?: string;
  cargoDescription: string;
  cargoWeightKg?: number;
  cargoType?: string;
  specialInstructions?: string;
  preferredPickupAt?: string;
  notes?: string;
}

export interface CreatePortalRequestResult {
  id: string;
  requestNumber: string;
  status: TripRequestStatus;
}

export async function listRequests(
  params: ListPortalRequestsParams = {},
): Promise<PortalTripRequestListResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiRequest<PortalTripRequestListResponse>(
    `/api/requests${qs ? `?${qs}` : ""}`,
    { method: "GET", cache: "no-store" },
  );
}

export async function getRequest(id: string): Promise<PortalTripRequestDetail> {
  return apiRequest<PortalTripRequestDetail>(`/api/requests/${id}`, {
    method: "GET",
    cache: "no-store",
  });
}

export async function createRequest(
  input: CreatePortalRequestInput,
): Promise<CreatePortalRequestResult> {
  return apiRequest<CreatePortalRequestResult>("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function cancelRequest(id: string, reason?: string): Promise<void> {
  await apiRequest<{ id: string; status: TripRequestStatus }>(
    `/api/requests/${id}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason ?? undefined }),
    },
  );
}
