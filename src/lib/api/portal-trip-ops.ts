import { apiRequest } from "@/lib/api/http";

// Enterprise trip operations — only meaningful for is_enterprise trips the
// caller owns. The consigner does everything ERP would: review the driver's
// proofs, record advance/final payments, manage holding charges, and cancel.

export type ProofReviewStatus = "pending" | "accepted" | "rejected" | null;

export interface TripOpsProof {
  id: string;
  proofType: string;
  objectKey: string | null;
  fileName: string | null;
  reviewStatus: ProofReviewStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface TripOpsPayment {
  id: string;
  type: "advance" | "final" | "refund" | "penalty";
  amount: number;
  status: string;
  method: string;
  reference: string | null;
  notes: string | null;
  proofObjectKey: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface TripOpsHoldingCharge {
  id: string;
  driverAmount: number;
  consignerAmount: number;
  note: string | null;
  createdAt: string;
}

export interface TripOps {
  isEnterprise: boolean;
  status: string;
  tripNumber: string;
  driverBidAmount: number | null;
  customerAmount: number | null;
  advanceDriverAmount: number | null;
  advancePaidAt: string | null;
  finalDriverAmount: number | null;
  finalPaidAt: string | null;
  holdingDriverTotal: number;
  holdingConsignerTotal: number;
  proofs: TripOpsProof[];
  payments: TripOpsPayment[];
  holdingCharges: TripOpsHoldingCharge[];
}

export async function getTripOps(tripId: string): Promise<TripOps> {
  return apiRequest<TripOps>(`/api/trips/${tripId}/ops`, { method: "GET", cache: "no-store" });
}

export async function reviewTripProof(
  tripId: string,
  proofId: string,
  action: "accept" | "reject",
  rejectionReason?: string,
): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/proof-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proofId, action, rejectionReason }),
  });
}

export interface RecordPaymentInput {
  paymentType: "advance" | "final";
  amount?: number;
  reference?: string;
  notes?: string;
  // Pay later — record the payment as pending (deferred) but still advance the
  // trip so the flow proceeds. It then shows on the Payments page until settled.
  defer?: boolean;
}

export async function recordTripPayment(
  tripId: string,
  input: RecordPaymentInput,
): Promise<{ amount: number; newTripStatus: string }> {
  return apiRequest(`/api/trips/${tripId}/record-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function addHoldingCharge(
  tripId: string,
  input: { driverAmount: number; consignerAmount?: number; note?: string },
): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/holding-charges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteHoldingCharge(tripId: string, chargeId: string): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/holding-charges/${chargeId}`, { method: "DELETE" });
}

export async function cancelTrip(tripId: string, reason: string): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}
