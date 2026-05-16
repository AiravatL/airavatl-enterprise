"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, Truck, ClipboardList, Plus, ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listTrips } from "@/lib/api/portal-trips";
import { listRequests } from "@/lib/api/portal-requests";
import type { TripRequestStatus } from "@/lib/api/portal-requests";
import { PageShell } from "../_components/page-shell";

interface Props {
  firstName: string | null;
}

const COUNT_REFETCH_MS = 60_000;

const STATUS_COLORS: Record<TripRequestStatus, string> = {
  pending_review: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<TripRequestStatus, string> = {
  pending_review: "Pending",
  converted: "Approved",
  rejected: "Rejected",
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
  const activeQuery = useQuery({
    queryKey: ["portal-trip-count", "active"] as const,
    queryFn: () => listTrips({ scope: "active", limit: 1 }),
    refetchInterval: COUNT_REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  });

  const historyQuery = useQuery({
    queryKey: ["portal-trip-count", "history"] as const,
    queryFn: () => listTrips({ scope: "history", limit: 1 }),
    refetchInterval: COUNT_REFETCH_MS * 5,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  });

  const pendingRequestsQuery = useQuery({
    queryKey: ["portal-request-count", "pending_review"] as const,
    queryFn: () => listRequests({ status: "pending_review", limit: 1 }),
    refetchInterval: COUNT_REFETCH_MS,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const recentRequestsQuery = useQuery({
    queryKey: ["portal-requests-recent"] as const,
    queryFn: () => listRequests({ limit: 5 }),
    refetchInterval: COUNT_REFETCH_MS,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  return (
    <PageShell
      title={`Welcome${firstName ? `, ${firstName}` : ""}`}
      description="Your trips with AiravatL, all in one place."
      actions={
        <Link href="/requests/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New Trip Request
          </Button>
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Pending requests"
          value={formatCount(pendingRequestsQuery.data?.total, pendingRequestsQuery.isLoading)}
          icon={<ClipboardList className="size-4 text-amber-600" />}
          href="/requests?status=pending_review"
        />
        <SummaryCard
          label="Active trips"
          value={formatCount(activeQuery.data?.total, activeQuery.isLoading)}
          icon={<Activity className="size-4 text-primary" />}
          href="/active-trips"
        />
        <SummaryCard
          label="History"
          value={formatCount(historyQuery.data?.total, historyQuery.isLoading)}
          icon={<Truck className="size-4 text-emerald-600" />}
          href="/trip-history"
        />
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-900">Recent trip requests</CardTitle>
            <Link href="/requests" className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentRequestsQuery.isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
          ) : (recentRequestsQuery.data?.items.length ?? 0) === 0 ? (
            <div className="px-4 py-8 text-center">
              <ClipboardList className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">No trip requests yet</p>
              <Link href="/requests/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Submit your first request
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(recentRequestsQuery.data?.items ?? []).map((req) => (
                <Link key={req.id} href={`/requests/${req.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">{req.requestNumber}</span>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[req.status]}`}>
                        {STATUS_LABELS[req.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {req.pickupCity ?? req.pickupAddress} → {req.deliveryCity ?? req.deliveryAddress}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 ml-2">{fmtDate(req.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Get started</CardTitle>
          <CardDescription>
            Live data refreshes automatically — no need to reload the page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/requests/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New trip request
          </Link>
          <Link
            href="/active-trips"
            className="inline-flex items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View active trips
          </Link>
          <Link
            href="/trip-history"
            className="inline-flex items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Trip history
          </Link>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function SummaryCard({
  label, value, icon, href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const body = (
    <Card className={href ? "transition-colors hover:bg-gray-50" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function formatCount(total: number | undefined, isLoading: boolean): string {
  if (total != null) return String(total);
  return isLoading ? "…" : "—";
}
