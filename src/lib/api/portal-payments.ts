import { apiRequest } from "@/lib/api/http";

// Enterprise payments = deferred ("pay later") driver payments the consigner
// still owes. Pay-now payments are settled immediately and don't appear here.

export interface PendingPayment {
  id: string;
  tripId: string;
  tripNumber: string;
  type: "advance" | "final" | "refund" | "penalty";
  amount: number;
  bidAmount: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  pickupCity: string | null;
  deliveryCity: string | null;
}

export interface PendingPaymentsResponse {
  total: number;
  totalAmount: number;
  limit: number;
  offset: number;
  items: PendingPayment[];
}

export interface ListPendingPaymentsParams {
  limit?: number;
  offset?: number;
}

export async function listPendingPayments(
  params: ListPendingPaymentsParams = {},
): Promise<PendingPaymentsResponse> {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiRequest<PendingPaymentsResponse>(`/api/payments${qs ? `?${qs}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });
}

export async function settlePayment(
  paymentId: string,
  input: { reference?: string; notes?: string } = {},
): Promise<void> {
  await apiRequest(`/api/payments/${paymentId}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// Settle ALL pending payments for one trip at once. Optionally adjust the
// advance amount (the final is recomputed = bid − advance when both pending).
export async function settleTripPayments(
  tripId: string,
  input: { advanceAmount?: number; reference?: string; notes?: string } = {},
): Promise<void> {
  await apiRequest(`/api/payments/trips/${tripId}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
