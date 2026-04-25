"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, History, Truck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listTrips } from "@/lib/api/portal-trips";
import { PageShell } from "../_components/page-shell";

interface Props {
  firstName: string | null;
}

const COUNT_REFETCH_MS = 60_000;

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

  return (
    <PageShell
      title={`Welcome${firstName ? `, ${firstName}` : ""}`}
      description="Your trips with AiravatL, all in one place."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <SummaryCard
          label="Last updated"
          value={lastUpdatedLabel(activeQuery.dataUpdatedAt)}
          icon={<History className="size-4 text-amber-600" />}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Get started</CardTitle>
          <CardDescription>
            Live trip data refreshes automatically — no need to reload the page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/active-trips"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
  label,
  value,
  icon,
  href,
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

function lastUpdatedLabel(timestamp: number): string {
  if (!timestamp) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
