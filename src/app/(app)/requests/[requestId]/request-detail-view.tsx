"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getRequest, cancelRequest } from "@/lib/api/portal-requests";
import type { PortalTripRequestDetail, TripRequestStatus } from "@/lib/api/portal-requests";
import { ArrowLeft, Ban, Loader2 } from "lucide-react";
import { PageShell } from "../../_components/page-shell";

const STATUS_COLORS: Record<TripRequestStatus, string> = {
  pending_review: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<TripRequestStatus, string> = {
  pending_review: "Pending review",
  converted: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RequestDetailView({ requestId }: { requestId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["portal-request", requestId],
    queryFn: () => getRequest(requestId),
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");

  const cancelMutation = useMutation({
    mutationFn: () => cancelRequest(requestId, reason.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-requests"] });
      queryClient.invalidateQueries({ queryKey: ["portal-request", requestId] });
      setCancelOpen(false);
      setReason("");
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : "Failed to cancel"),
  });

  if (detailQuery.isLoading) {
    return (
      <PageShell title="Loading…" description="">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </PageShell>
    );
  }
  if (detailQuery.error || !detailQuery.data) {
    return (
      <PageShell title="Request not found" description="">
        <Button variant="outline" size="sm" onClick={() => router.push("/requests")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to requests
        </Button>
      </PageShell>
    );
  }

  const req = detailQuery.data;
  const isPending = req.status === "pending_review";

  return (
    <PageShell
      title={`Trip Request ${req.requestNumber}`}
      actions={
        <Button variant="outline" size="sm" onClick={() => router.push("/requests")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
      }
    >
      <div className="space-y-4 max-w-3xl">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1.5">
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                {STATUS_LABELS[req.status]}
              </span>
              <p className="text-xs text-gray-500">Submitted {fmtDate(req.createdAt)}</p>
              {req.linkedDeliveryRequestNumber && (
                <p className="text-sm text-gray-700">
                  Approved as auction <span className="font-medium">{req.linkedDeliveryRequestNumber}</span> — you&apos;ll see updates under Active Trips.
                </p>
              )}
              {req.status === "rejected" && req.rejectionReason && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Reason:</span> {req.rejectionReason}
                </p>
              )}
              {req.status === "cancelled" && req.cancelledReason && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Reason:</span> {req.cancelledReason}
                </p>
              )}
            </div>
            {isPending && (
              <Button
                variant="outline"
                onClick={() => { setCancelOpen(true); setReason(""); setActionError(""); }}
              >
                <Ban className="h-4 w-4 mr-1.5" /> Cancel Request
              </Button>
            )}
          </div>
        </Card>

        <DetailCard req={req} />
      </div>

      <Dialog open={cancelOpen} onOpenChange={(open) => { setCancelOpen(open); if (!open) setActionError(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel trip request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">Reason (optional)</Label>
            <textarea
              rows={3} maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="Optional cancellation note"
              className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep</Button>
            <Button
              onClick={() => { setActionError(""); cancelMutation.mutate(); }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Cancel request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function DetailCard({ req }: { req: PortalTripRequestDetail }) {
  return (
    <Card className="p-4 sm:p-5 space-y-5 text-sm">
      <Block title="Pickup">
        <Kv label="Address" value={req.pickupAddress} />
        {(req.pickupCity || req.pickupState) && (
          <Kv label="Location" value={[req.pickupCity, req.pickupState].filter(Boolean).join(", ")} />
        )}
        {req.pickupContactName && (
          <Kv label="Contact" value={`${req.pickupContactName}${req.pickupContactPhone ? ` · ${req.pickupContactPhone}` : ""}`} />
        )}
      </Block>

      <Block title="Delivery">
        <Kv label="Address" value={req.deliveryAddress} />
        {(req.deliveryCity || req.deliveryState) && (
          <Kv label="Location" value={[req.deliveryCity, req.deliveryState].filter(Boolean).join(", ")} />
        )}
        {req.deliveryContactName && (
          <Kv label="Contact" value={`${req.deliveryContactName}${req.deliveryContactPhone ? ` · ${req.deliveryContactPhone}` : ""}`} />
        )}
      </Block>

      <Block title="Cargo">
        <Kv label="Description" value={req.cargoDescription} />
        {req.cargoWeightKg != null && (
          <Kv label="Weight" value={`${req.cargoWeightKg.toLocaleString("en-IN")} kg`} />
        )}
        {req.cargoType && <Kv label="Type" value={req.cargoType} />}
        {req.specialInstructions && <Kv label="Special instructions" value={req.specialInstructions} />}
      </Block>

      {(req.preferredPickupAt || req.notes) && (
        <Block title="Preferences">
          {req.preferredPickupAt && <Kv label="Preferred pickup" value={fmtDate(req.preferredPickupAt)} />}
          {req.notes && <Kv label="Notes" value={req.notes} />}
        </Block>
      )}
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="col-span-2 text-gray-900 whitespace-pre-wrap">{value}</span>
    </div>
  );
}
