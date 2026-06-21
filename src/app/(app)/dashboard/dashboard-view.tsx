"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, Truck, Gavel, ArrowRight, ArrowDownUp, Map, Circle, Square } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LiveTrackingMap } from "@/components/trip-detail/live-tracking-map.client";
import { listTrips } from "@/lib/api/portal-trips";
import { listAuctions } from "@/lib/api/portal-auctions";
import type { EnterpriseAuctionStatus } from "@/lib/api/portal-auctions";
import type { PlaceDetails } from "@/lib/api/maps";
import { setDraftLocations } from "@/lib/auction-draft";
import { LocationPicker } from "../requests/new/location-picker";
import { PageShell } from "../_components/page-shell";

interface Props {
  firstName: string | null;
}

const COUNT_REFETCH_MS = 60_000;

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

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DashboardView({ firstName }: Props) {
  const router = useRouter();
  const sessionToken = useMemo(() => crypto.randomUUID(), []);
  const [pickup, setPickup] = useState<PlaceDetails | null>(null);
  const [delivery, setDelivery] = useState<PlaceDetails | null>(null);
  const bothSet = pickup !== null && delivery !== null;
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const deliveryInputRef = useRef<HTMLInputElement>(null);

  const startAuction = () => {
    setDraftLocations({ pickup, delivery });
    router.push("/auctions/new");
  };

  const liveAuctionsQuery = useQuery({
    queryKey: ["portal-auction-count", "active"] as const,
    queryFn: () => listAuctions({ status: "active", limit: 1 }),
    refetchInterval: COUNT_REFETCH_MS,
    placeholderData: (prev) => prev,
  });
  const activeQuery = useQuery({
    queryKey: ["portal-trip-count", "active"] as const,
    queryFn: () => listTrips({ scope: "active", limit: 1 }),
    refetchInterval: COUNT_REFETCH_MS,
    placeholderData: (prev) => prev,
  });
  const historyQuery = useQuery({
    queryKey: ["portal-trip-count", "history"] as const,
    queryFn: () => listTrips({ scope: "history", limit: 1 }),
    refetchInterval: COUNT_REFETCH_MS * 5,
    placeholderData: (prev) => prev,
  });
  const recentAuctionsQuery = useQuery({
    queryKey: ["portal-auctions-recent"] as const,
    queryFn: () => listAuctions({ limit: 5 }),
    refetchInterval: COUNT_REFETCH_MS,
    placeholderData: (prev) => prev,
  });

  return (
    <PageShell
      title={`Welcome${firstName ? `, ${firstName}` : ""}`}
      description="Where are we picking up and dropping off?"
      hideHeaderOnMobile
    >
      {/* Location-first hero — pick pickup & drop, then start the auction */}
      <div className="rounded-2xl bg-white p-4 shadow-sm sm:border sm:border-gray-100">
        <div className="relative flex gap-2">
          {/* Inputs column with a connector linking the two pins */}
          <div className="relative flex-1 space-y-2">
            <span
              aria-hidden
              className="pointer-events-none absolute left-[20px] top-[22px] bottom-[22px] w-px bg-gray-300"
            />
            <LocationPicker
              label="Pickup location"
              variant="booking"
              placeholder="Pickup location"
              leadingIcon={<Circle className="h-[18px] w-[18px]" />}
              inputRef={pickupInputRef}
              required
              value={pickup}
              sessionToken={sessionToken}
              onSelect={setPickup}
              onClear={() => setPickup(null)}
            />
            <LocationPicker
              label="Drop-off location"
              variant="booking"
              placeholder="Drop-off location"
              leadingIcon={<Square className="h-[18px] w-[18px] fill-primary" />}
              inputRef={deliveryInputRef}
              required
              value={delivery}
              sessionToken={sessionToken}
              onSelect={setDelivery}
              onClear={() => setDelivery(null)}
            />
          </div>

          {/* Map-pick buttons (focus the matching field for now) */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => pickupInputRef.current?.focus()}
              aria-label="Pick pickup on map"
              title="Pick on map"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-primary hover:bg-gray-200"
            >
              <Map className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => deliveryInputRef.current?.focus()}
              aria-label="Pick drop-off on map"
              title="Pick on map"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-primary hover:bg-gray-200"
            >
              <Map className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* Swap pickup & drop — sits on the seam between the two fields */}
          <button
            type="button"
            onClick={() => { const p = pickup; setPickup(delivery); setDelivery(p); }}
            disabled={!pickup && !delivery}
            className="absolute right-14 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-primary shadow-md hover:bg-gray-50 disabled:opacity-40"
            title="Swap pickup & drop"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        {bothSet && (
          <LiveTrackingMap
            pickup={{ lat: pickup.latitude, lng: pickup.longitude }}
            delivery={{ lat: delivery.latitude, lng: delivery.longitude }}
            driver={{ lat: null, lng: null }}
            routePolyline={null}
            className="mt-3 h-48 sm:h-56"
          />
        )}
      </div>

      <Button
        className="mt-4 h-12 w-full rounded-xl text-base font-semibold"
        disabled={!bothSet}
        onClick={startAuction}
      >
        Next: Material Details <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>

      {/* Activity summary */}
      <div className="mt-4 hidden grid-cols-3 gap-3 sm:grid">
        <SummaryCard label="Live auctions"
          value={formatCount(liveAuctionsQuery.data?.total, liveAuctionsQuery.isLoading)}
          icon={<Gavel className="size-4 text-green-600" />} href="/auctions" />
        <SummaryCard label="Active trips"
          value={formatCount(activeQuery.data?.total, activeQuery.isLoading)}
          icon={<Activity className="size-4 text-primary" />} href="/active-trips" />
        <SummaryCard label="History"
          value={formatCount(historyQuery.data?.total, historyQuery.isLoading)}
          icon={<Truck className="size-4 text-emerald-600" />} href="/trip-history" />
      </div>

      <Card className="mt-4 hidden sm:block">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">Recent auctions</span>
            <Link href="/auctions" className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentAuctionsQuery.isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
          ) : (recentAuctionsQuery.data?.items.length ?? 0) === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">No auctions yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(recentAuctionsQuery.data?.items ?? []).map((a) => (
                <Link key={a.requestId} href={`/auctions/${a.requestId}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">{a.requestNumber}</span>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[a.status]}`}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {a.pickupCity ?? a.pickupAddress} → {a.deliveryCity ?? a.deliveryAddress}
                      {a.totalBidsCount > 0 ? ` · ${a.totalBidsCount} bids` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 ml-2">{fmtDate(a.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function SummaryCard({ label, value, icon, href }: {
  label: string; value: string; icon: React.ReactNode; href?: string;
}) {
  const body = (
    <Card className={href ? "transition-colors hover:bg-gray-50" : undefined}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="mt-1.5 text-xl font-semibold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function formatCount(total: number | undefined, isLoading: boolean): string {
  if (total != null) return String(total);
  return isLoading ? "…" : "—";
}
