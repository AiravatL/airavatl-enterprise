"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, RefreshCw, Search, Truck, History, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listTrips, type PortalTripRow, type TripScope, type TripStatus } from "@/lib/api/portal-trips";
import { formatCurrency, formatDate, formatRoute } from "@/lib/format";
import { tripStatusLabel } from "@/lib/format/trip-status";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { cn } from "@/lib/utils";

interface Props {
  scope: TripScope;
  emptyTitle: string;
  emptyDescription: string;
}

// Polling cadence per scope. Active trips change frequently (driver moving,
// status transitions); history is mostly read-only once written.
const REFETCH_INTERVAL_MS: Record<TripScope, number | false> = {
  active: 30_000,
  history: 5 * 60_000,
  all: 60_000,
};

const DATE_RANGES = [
  { value: "all", label: "All time", days: null },
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
] as const;

type DateRangeValue = (typeof DATE_RANGES)[number]["value"];

export function TripsTable({ scope, emptyTitle, emptyDescription }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<TripStatus>>(new Set());
  const [dateRange, setDateRange] = useState<DateRangeValue>("all");

  const query = useQuery({
    queryKey: ["portal-trips", scope] as const,
    queryFn: () => listTrips({ scope, limit: 100 }),
    refetchInterval: REFETCH_INTERVAL_MS[scope],
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  });

  const allItems = query.data?.items ?? [];
  const isBackgroundRefreshing = query.isFetching && !query.isLoading;

  // Show only the statuses that actually appear in the data — keeps the
  // chip row scope-aware without hardcoding which statuses go where.
  const statusOptions = useMemo(() => {
    const seen = new Set<TripStatus>();
    for (const t of allItems) seen.add(t.status);
    return Array.from(seen).sort();
  }, [allItems]);

  const items = useMemo(() => {
    let filtered = allItems;

    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((t) =>
        [
          t.tripNumber,
          t.requestNumber,
          t.pickupCity,
          t.deliveryCity,
          t.pickupState,
          t.deliveryState,
          t.vehicleType,
        ]
          .filter((v): v is string => Boolean(v))
          .some((v) => v.toLowerCase().includes(q)),
      );
    }

    if (statusFilter.size > 0) {
      filtered = filtered.filter((t) => statusFilter.has(t.status));
    }

    const range = DATE_RANGES.find((r) => r.value === dateRange);
    if (range?.days != null) {
      const cutoff = Date.now() - range.days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((t) => {
        const dateStr =
          scope === "history"
            ? (t.deliveryCompletedAt ?? t.cancelledAt ?? t.updatedAt)
            : (t.consignmentDate ?? t.createdAt);
        if (!dateStr) return false;
        const ms = new Date(dateStr).getTime();
        return Number.isFinite(ms) && ms >= cutoff;
      });
    }

    return filtered;
  }, [allItems, search, statusFilter, dateRange, scope]);

  const hasFilters =
    search.trim() !== "" || statusFilter.size > 0 || dateRange !== "all";

  const toggleStatus = (s: TripStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter(new Set());
    setDateRange("all");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trip #, city, or vehicle"
            className="pl-9 pr-9"
            inputMode="search"
            autoCapitalize="none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <RefreshIndicator
          isRefreshing={isBackgroundRefreshing}
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        />
      </div>

      {(statusOptions.length > 1 || hasFilters) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {statusOptions.map((s) => {
            const active = statusFilter.has(s);
            return (
              <FilterChip
                key={s}
                label={tripStatusLabel(s)}
                active={active}
                onClick={() => toggleStatus(s)}
              />
            );
          })}

          {statusOptions.length > 0 && (
            <span aria-hidden className="mx-1 h-4 w-px bg-gray-200" />
          )}

          {DATE_RANGES.map((r) => (
            <FilterChip
              key={r.value}
              label={r.label}
              active={dateRange === r.value}
              onClick={() => setDateRange(r.value)}
            />
          ))}

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
      )}

      {query.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading trips…
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : "Unable to load trips"}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        hasFilters ? (
          <NoMatchState onClear={clearFilters} />
        ) : (
          <EmptyState scope={scope} title={emptyTitle} description={emptyDescription} />
        )
      ) : (
        <>
          <DesktopTable items={items} scope={scope} />
          <MobileList items={items} scope={scope} />
        </>
      )}

      {query.data && allItems.length > 0 ? (
        <p className="text-[11px] text-muted-foreground text-right">
          {hasFilters
            ? `Showing ${items.length} of ${allItems.length} loaded`
            : `Showing ${items.length} of ${query.data.total}`}
        </p>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
      )}
    >
      {label}
    </button>
  );
}

function RefreshIndicator({
  isRefreshing,
  onClick,
  disabled,
}: {
  isRefreshing: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={isRefreshing ? "Updating…" : "Refresh"}
      aria-label={isRefreshing ? "Updating" : "Refresh"}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed md:h-9 md:w-9"
    >
      <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
    </button>
  );
}

function DesktopTable({ items, scope }: { items: PortalTripRow[]; scope: TripScope }) {
  return (
    <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Trip</th>
              <th className="px-4 py-2.5 text-left font-medium">Route</th>
              <th className="px-4 py-2.5 text-left font-medium">Vehicle</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">
                {scope === "history" ? "Completed" : "Date"}
              </th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((t) => (
              <tr
                key={t.tripId}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  window.location.assign(`/trips/${t.tripId}`);
                }}
              >
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/trips/${t.tripId}`}
                    className="font-medium text-gray-900 hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t.tripNumber}
                  </Link>
                  {t.requestNumber ? (
                    <p className="text-[11px] text-gray-400">{t.requestNumber}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="text-gray-700">
                    {formatRoute(t.pickupCity, t.deliveryCity)}
                  </p>
                  {(t.pickupState || t.deliveryState) && (
                    <p className="text-[11px] text-gray-400">
                      {[t.pickupState, t.deliveryState].filter(Boolean).join(" → ")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="text-gray-700 capitalize">{t.vehicleType ?? "—"}</span>
                </td>
                <td className="px-4 py-3 align-top">
                  <TripStatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 align-top text-gray-600">
                  {scope === "history"
                    ? formatDate(t.deliveryCompletedAt ?? t.cancelledAt ?? t.updatedAt)
                    : formatDate(t.consignmentDate ?? t.createdAt)}
                </td>
                <td className="px-4 py-3 align-top text-right font-medium text-gray-900 whitespace-nowrap">
                  {formatCurrency(t.customerAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileList({ items, scope }: { items: PortalTripRow[]; scope: TripScope }) {
  return (
    <div className="sm:hidden space-y-2">
      {items.map((t) => (
        <Link
          key={t.tripId}
          href={`/trips/${t.tripId}`}
          className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors active:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{t.tripNumber}</p>
              <p className="mt-0.5 text-sm text-gray-700 truncate">
                {formatRoute(t.pickupCity, t.deliveryCity)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <TripStatusBadge status={t.status} />
              <ChevronRight className="size-4 text-gray-300" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span className="capitalize truncate">
              {t.vehicleType ?? "—"} ·{" "}
              {scope === "history"
                ? formatDate(t.deliveryCompletedAt ?? t.cancelledAt ?? t.updatedAt)
                : formatDate(t.consignmentDate ?? t.createdAt)}
            </span>
            <span className="font-medium text-gray-900">
              {formatCurrency(t.customerAmount)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function NoMatchState({ onClear }: { onClear: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Search className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-gray-900">No trips match</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Try a different search or clear the filters.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <X className="size-3.5" /> Clear filters
        </button>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  scope,
  title,
  description,
}: {
  scope: TripScope;
  title: string;
  description: string;
}) {
  const Icon = scope === "history" ? History : Truck;
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
