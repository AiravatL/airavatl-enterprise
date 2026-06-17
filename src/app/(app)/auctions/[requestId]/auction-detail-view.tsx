"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAuction,
  getAuctionBids,
  selectAuctionWinner,
  type EnterpriseAuctionBid,
  type EnterpriseAuctionStatus,
} from "@/lib/api/portal-auctions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, MapPin, Package, Truck, Star, Phone, Gavel, CheckCircle2, Trophy,
} from "lucide-react";
import { PageShell } from "../../_components/page-shell";

const STATUS_COLORS: Record<EnterpriseAuctionStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  ended: "bg-amber-100 text-amber-700",
  winner_selected: "bg-blue-100 text-blue-700",
  trip_created: "bg-violet-100 text-violet-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<EnterpriseAuctionStatus, string> = {
  draft: "Draft",
  active: "Live",
  ended: "Ended",
  winner_selected: "Winner picked",
  trip_created: "Trip created",
  cancelled: "Cancelled",
};

function money(n: number | null) {
  return n != null ? `₹${n.toLocaleString("en-IN")}` : "—";
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AuctionDetailView({ requestId }: { requestId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmBid, setConfirmBid] = useState<EnterpriseAuctionBid | null>(null);
  const [error, setError] = useState("");

  const auctionQuery = useQuery({
    queryKey: ["portal-auction", requestId],
    queryFn: () => getAuction(requestId),
    refetchInterval: 20_000,
  });

  const auction = auctionQuery.data;
  const tripDone = auction ? ["trip_created"].includes(auction.status) : false;

  const bidsQuery = useQuery({
    queryKey: ["portal-auction-bids", requestId],
    queryFn: () => getAuctionBids(requestId),
    refetchInterval: tripDone ? false : 15_000,
    placeholderData: keepPreviousData,
    enabled: !!auction,
  });

  const bids = bidsQuery.data?.bids ?? [];
  const canSelect = auction ? ["active", "ended", "winner_selected"].includes(auction.status) && !auction.tripId : false;

  const selectMutation = useMutation({
    mutationFn: (bidId: string) => selectAuctionWinner(requestId, bidId),
    onSuccess: (result) => {
      setConfirmBid(null);
      queryClient.invalidateQueries({ queryKey: ["portal-auction", requestId] });
      queryClient.invalidateQueries({ queryKey: ["portal-auction-bids", requestId] });
      queryClient.invalidateQueries({ queryKey: ["portal-auctions"] });
      router.push(`/trips/${result.tripId}`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Couldn't select winner"),
  });

  if (auctionQuery.isLoading) {
    return (
      <PageShell title="Auction">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </PageShell>
    );
  }

  if (auctionQuery.error || !auction) {
    return (
      <PageShell title="Auction">
        <Card className="p-6 text-center">
          <p className="text-sm text-gray-600">
            {auctionQuery.error instanceof Error ? auctionQuery.error.message : "Auction not found"}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/auctions")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to auctions
          </Button>
        </Card>
      </PageShell>
    );
  }

  const winnerBid = bids.find((b) => b.id === auction.winnerBidId);

  return (
    <PageShell
      title={auction.requestNumber}
      description="Review bids and pick the driver you want"
      actions={
        <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[auction.status]}`}>
          {STATUS_LABELS[auction.status]}
        </span>
      }
    >
      <div className="mb-3">
        <Button variant="outline" size="sm" onClick={() => router.push("/auctions")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Trip created banner */}
      {auction.tripId && (
        <Card className="mb-4 p-4 border-violet-200 bg-violet-50/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-violet-900">Winner selected — trip created</p>
                <p className="text-xs text-violet-700">
                  {winnerBid?.bidderName ? `${winnerBid.bidderName} · ` : ""}
                  You pay {money(winnerBid?.bidAmount ?? auction.lowestBidAmount)} directly to the driver.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => router.push(`/trips/${auction.tripId}`)}>
              View trip
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: route + cargo */}
        <Card className="lg:col-span-1 p-4 space-y-4 h-fit">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Route</p>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-900">{auction.pickupAddress}</p>
                {auction.pickupContactName && (
                  <p className="text-xs text-gray-500">
                    {auction.pickupContactName}
                    {auction.pickupContactPhone ? ` · ${auction.pickupContactPhone}` : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="ml-2 my-1 h-4 border-l border-dashed border-gray-300" />
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-900">{auction.deliveryAddress}</p>
                {auction.deliveryContactName && (
                  <p className="text-xs text-gray-500">
                    {auction.deliveryContactName}
                    {auction.deliveryContactPhone ? ` · ${auction.deliveryContactPhone}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <Detail icon={<Truck className="h-4 w-4 text-gray-400" />} label="Vehicle" value={auction.vehicleType} />
            <Detail icon={<Package className="h-4 w-4 text-gray-400" />} label="Cargo"
              value={[auction.cargoDescription, auction.cargoWeightKg ? `${auction.cargoWeightKg} kg` : null].filter(Boolean).join(" · ") || null} />
            <Detail icon={<Gavel className="h-4 w-4 text-gray-400" />} label="Auction ends" value={formatDateTime(auction.auctionEndTime)} />
            <Detail icon={<Package className="h-4 w-4 text-gray-400" />} label="Consignment" value={formatDateTime(auction.consignmentDate)} />
          </div>
          {auction.specialInstructions && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Instructions</p>
              <p className="text-sm text-gray-700">{auction.specialInstructions}</p>
            </div>
          )}
        </Card>

        {/* Right: bids */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Bids {bids.length > 0 && <span className="text-gray-400">({bids.length})</span>}
            </h3>
            {bidsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-gray-300" />}
          </div>

          {bidsQuery.isLoading ? (
            <Card className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></Card>
          ) : bids.length === 0 ? (
            <Card className="p-8 text-center">
              <Gavel className="mx-auto h-9 w-9 text-gray-300 mb-2" />
              <p className="text-sm text-gray-600">No bids yet</p>
              <p className="text-xs text-gray-400 mt-1">Drivers will appear here as they bid. This refreshes automatically.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {bids.map((bid) => {
                const isWinner = bid.id === auction.winnerBidId || bid.status === "won";
                return (
                  <Card key={bid.id} className={`p-3 ${isWinner ? "border-violet-300 bg-violet-50/50" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {bid.bidderName ?? "Driver"}
                          </p>
                          {isWinner && (
                            <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                              <Trophy className="h-3 w-3" /> Won
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                          {bid.bidderRating != null && bid.bidderRating > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                              {bid.bidderRating.toFixed(1)}
                            </span>
                          )}
                          {bid.bidderTripsCompleted != null && (
                            <span>{bid.bidderTripsCompleted} trips</span>
                          )}
                          {bid.vehicleRegistration && <span>{bid.vehicleRegistration}</span>}
                          {bid.vehicleBodyType && <span>{bid.vehicleBodyType}</span>}
                        </div>
                        {bid.bidNotes && <p className="text-xs text-gray-600 mt-1.5">{bid.bidNotes}</p>}
                        {bid.bidderPhone && (
                          <a href={`tel:${bid.bidderPhone}`} className="inline-flex items-center gap-1 text-xs text-primary mt-1.5 hover:underline">
                            <Phone className="h-3 w-3" /> {bid.bidderPhone}
                          </a>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-gray-900">{money(bid.bidAmount)}</p>
                        {canSelect && !isWinner && (
                          <Button size="sm" className="mt-1.5" onClick={() => { setError(""); setConfirmBid(bid); }}>
                            Pick driver
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!confirmBid} onOpenChange={(open) => !open && setConfirmBid(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick this driver?</DialogTitle>
          </DialogHeader>
          {confirmBid && (
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <span className="font-medium text-gray-900">{confirmBid.bidderName ?? "Driver"}</span> will be
                assigned this trip and notified to accept.
              </p>
              <p className="rounded-md bg-gray-50 p-3">
                You&apos;ll pay <span className="font-semibold text-gray-900">{money(confirmBid.bidAmount)}</span> directly
                to the driver. AiravatL doesn&apos;t collect anything for this trip.
              </p>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setConfirmBid(null)} disabled={selectMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmBid && selectMutation.mutate(confirmBid.id)}
              disabled={selectMutation.isPending}
            >
              {selectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Confirm & create trip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
      <span className="text-sm text-gray-700 truncate">{value ?? "—"}</span>
    </div>
  );
}
