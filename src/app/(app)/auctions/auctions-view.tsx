"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listAuctions } from "@/lib/api/portal-auctions";
import type { EnterpriseAuctionStatus } from "@/lib/api/portal-auctions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Gavel, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell } from "../_components/page-shell";

const STATUS_TABS: { value: EnterpriseAuctionStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "active", label: "Live" },
  { value: "ended", label: "Ended" },
  { value: "winner_selected", label: "Winner picked" },
  { value: "trip_created", label: "Trip created" },
  { value: "cancelled", label: "Cancelled" },
];

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

const PAGE_SIZE = 50;

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AuctionsView() {
  const router = useRouter();
  const [status, setStatus] = useState<EnterpriseAuctionStatus | "">("");
  const [offset, setOffset] = useState(0);

  const filters = useMemo(
    () => ({ status: status || undefined, limit: PAGE_SIZE, offset }),
    [status, offset],
  );

  const query = useQuery({
    queryKey: ["portal-auctions", filters],
    queryFn: () => listAuctions(filters),
    staleTime: 15_000,
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  return (
    <PageShell
      title="Auctions"
      description="Publish loads, watch bids, and pick your driver"
      actions={
        <Button onClick={() => router.push("/auctions/new")} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> New Auction
        </Button>
      }
    >
      <div className="flex flex-wrap gap-1.5 mb-4">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value || "all"}
            variant={status === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatus(tab.value);
              setOffset(0);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {query.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {!query.isLoading && query.error && (
        <Card className="p-4 text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : "Failed to load"}
        </Card>
      )}

      {!query.isLoading && !query.error && items.length === 0 && (
        <Card className="p-8 text-center">
          <Gavel className="mx-auto h-10 w-10 text-gray-300 mb-2" />
          <p className="text-sm text-gray-600">No auctions yet</p>
          <Button className="mt-4" size="sm" onClick={() => router.push("/auctions/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Publish your first auction
          </Button>
        </Card>
      )}

      {items.length > 0 && (
        <>
          <Card>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Auction #</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Route</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Vehicle</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Bids</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Ends</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.requestId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/auctions/${item.requestId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {item.requestNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700 truncate max-w-[240px]">
                        {(item.pickupCity ?? item.pickupAddress)} →{" "}
                        {(item.deliveryCity ?? item.deliveryAddress)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[160px]">
                        {item.vehicleType ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {item.totalBidsCount}
                        {item.lowestBidAmount != null && (
                          <span className="text-xs text-gray-400">
                            {" "}· ₹{item.lowestBidAmount.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(item.auctionEndTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden divide-y divide-gray-50">
              {items.map((item) => (
                <Link
                  key={item.requestId}
                  href={`/auctions/${item.requestId}`}
                  className="block p-3 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{item.requestNumber}</span>
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {(item.pickupCity ?? item.pickupAddress)} →{" "}
                    {(item.deliveryCity ?? item.deliveryAddress)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.vehicleType ?? "—"} · {item.totalBidsCount} bids · ends {formatDate(item.auctionEndTime)}
                  </p>
                </Link>
              ))}
            </div>
          </Card>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-sm text-gray-500">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
