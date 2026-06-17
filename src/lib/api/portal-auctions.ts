import { apiRequest } from "@/lib/api/http";

// Enterprise auctions — the consigner creates and operates these themselves.
// They are real `delivery_requests` flagged is_erp + is_enterprise; drivers in
// the shared pool bid on them exactly like any other auction.

export type EnterpriseAuctionStatus =
  | "draft"
  | "active"
  | "ended"
  | "winner_selected"
  | "trip_created"
  | "cancelled";

export interface VehicleMasterType {
  id: string;
  code: string;
  name: string;
  capacityTons: number | null;
  bodyType: string | null;
  lengthFeet: number | null;
  wheelCount: number | null;
}

export interface EnterpriseAuctionRow {
  requestId: string;
  requestNumber: string;
  status: EnterpriseAuctionStatus;
  pickupCity: string | null;
  pickupState: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  vehicleType: string | null;
  cargoDescription: string | null;
  consignmentDate: string | null;
  auctionEndTime: string | null;
  totalBidsCount: number;
  lowestBidAmount: number | null;
  winnerBidId: string | null;
  tripId: string | null;
  createdAt: string;
}

export interface EnterpriseAuctionListResponse {
  total: number;
  limit: number;
  offset: number;
  items: EnterpriseAuctionRow[];
}

export interface ListAuctionsParams {
  status?: EnterpriseAuctionStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateAuctionInput {
  pickupAddress: string;
  pickupCity?: string;
  pickupState?: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupPlaceId?: string;
  pickupPrimaryText?: string;
  pickupSecondaryText?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  deliveryAddress: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  deliveryPlaceId?: string;
  deliveryPrimaryText?: string;
  deliverySecondaryText?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  vehicleMasterTypeId: string;
  cargoDescription?: string;
  cargoWeightKg?: number;
  cargoType?: string;
  specialInstructions?: string;
  consignmentDate: string;
  scheduledPickupTime?: string;
  auctionDurationMinutes: number;
}

export interface CreateAuctionResult {
  requestId: string;
  requestNumber: string;
  status: EnterpriseAuctionStatus;
}

export interface EnterpriseAuctionDetail {
  requestId: string;
  requestNumber: string;
  status: EnterpriseAuctionStatus;
  pickupAddress: string | null;
  pickupCity: string | null;
  pickupState: string | null;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  vehicleType: string | null;
  cargoDescription: string | null;
  cargoWeightKg: number | null;
  cargoType: string | null;
  specialInstructions: string | null;
  estimatedDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  consignmentDate: string | null;
  auctionStartTime: string | null;
  auctionEndTime: string | null;
  auctionDurationMinutes: number | null;
  totalBidsCount: number;
  lowestBidAmount: number | null;
  winnerBidId: string | null;
  winnerSelectedAt: string | null;
  tripId: string | null;
  createdAt: string;
}

export interface EnterpriseAuctionBid {
  id: string;
  bidAmount: number;
  estimatedPickupTime: string | null;
  estimatedDeliveryTime: string | null;
  bidNotes: string | null;
  status: string;
  createdAt: string;
  bidderId: string;
  bidderType: string;
  bidderName: string | null;
  bidderPhone: string | null;
  bidderRating: number | null;
  bidderTripsCompleted: number | null;
  vehicleRegistration: string | null;
  vehicleMakeModel: string | null;
  vehicleCapacityTons: number | null;
  vehicleBodyType: string | null;
}

export interface SelectWinnerResult {
  tripId: string;
  tripNumber: string;
  consignerTripAmount: number;
}

export async function getAuction(requestId: string): Promise<EnterpriseAuctionDetail> {
  return apiRequest<EnterpriseAuctionDetail>(`/api/auctions/${requestId}`, {
    method: "GET",
    cache: "no-store",
  });
}

export async function getAuctionBids(requestId: string): Promise<{ bids: EnterpriseAuctionBid[] }> {
  return apiRequest<{ bids: EnterpriseAuctionBid[] }>(`/api/auctions/${requestId}/bids`, {
    method: "GET",
    cache: "no-store",
  });
}

export async function selectAuctionWinner(
  requestId: string,
  bidId: string,
): Promise<SelectWinnerResult> {
  return apiRequest<SelectWinnerResult>(`/api/auctions/${requestId}/select-winner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bidId }),
  });
}

export async function listVehicleTypes(): Promise<VehicleMasterType[]> {
  return apiRequest<VehicleMasterType[]>("/api/vehicle-types", {
    method: "GET",
    cache: "no-store",
  });
}

export async function listAuctions(
  params: ListAuctionsParams = {},
): Promise<EnterpriseAuctionListResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.search) sp.set("search", params.search);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiRequest<EnterpriseAuctionListResponse>(
    `/api/auctions${qs ? `?${qs}` : ""}`,
    { method: "GET", cache: "no-store" },
  );
}

export async function createAuction(
  input: CreateAuctionInput,
): Promise<CreateAuctionResult> {
  return apiRequest<CreateAuctionResult>("/api/auctions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
