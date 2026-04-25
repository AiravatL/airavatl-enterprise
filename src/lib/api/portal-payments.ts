import { apiRequest } from "@/lib/api/http";

export type ReceivableStatus =
  | "pending"
  | "partial"
  | "collected"
  | "overdue"
  | "written_off";

export interface PortalReceivable {
  id: string;
  tripId: string | null;
  tripNumber: string | null;
  invoiceAmount: number;
  amountReceived: number;
  amountOutstanding: number;
  holdingAmount: number;
  status: ReceivableStatus;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  pickupCity: string | null;
  pickupState: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryCompletedAt: string | null;
}

export interface PortalReceivableListResponse {
  total: number;
  limit: number;
  offset: number;
  items: PortalReceivable[];
}

export interface PortalPaymentsSummary {
  totalOutstanding: number;
  totalOverdue: number;
  totalPaid: number;
  totalInvoiced: number;
  countOutstanding: number;
  countOverdue: number;
}

export interface ListPaymentsParams {
  status?: ReceivableStatus;
  limit?: number;
  offset?: number;
}

export async function listPayments(
  params: ListPaymentsParams = {},
): Promise<PortalReceivableListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiRequest<PortalReceivableListResponse>(
    `/api/payments${qs ? `?${qs}` : ""}`,
    { method: "GET", cache: "no-store" },
  );
}

export async function getPaymentsSummary(): Promise<PortalPaymentsSummary> {
  return apiRequest<PortalPaymentsSummary>("/api/payments/summary", {
    method: "GET",
    cache: "no-store",
  });
}
