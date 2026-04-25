"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";

// (CheckCircle2 still used by EmptyState below.)

import { Card, CardContent } from "@/components/ui/card";
import {
  getPaymentsSummary,
  listPayments,
  type PortalReceivable,
  type ReceivableStatus,
} from "@/lib/api/portal-payments";
import { formatCurrency, formatDate, formatRoute } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageShell } from "../_components/page-shell";

const SUMMARY_REFETCH_MS = 60_000;
const LIST_REFETCH_MS = 60_000;

const FILTERS: { value: ReceivableStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "collected", label: "Paid" },
];

const STATUS_TONE: Record<ReceivableStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  partial: "bg-blue-50 text-blue-700 ring-blue-200",
  collected: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  written_off: "bg-gray-100 text-gray-600 ring-gray-200",
};

const STATUS_LABEL: Record<ReceivableStatus, string> = {
  pending: "Pending",
  partial: "Partial",
  collected: "Paid",
  overdue: "Overdue",
  written_off: "Written off",
};

export function PaymentsView() {
  const [filter, setFilter] = useState<ReceivableStatus | "all">("all");

  const summaryQuery = useQuery({
    queryKey: ["portal-payments-summary"] as const,
    queryFn: getPaymentsSummary,
    refetchInterval: SUMMARY_REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  });

  const listQuery = useQuery({
    queryKey: ["portal-payments", filter] as const,
    queryFn: () =>
      listPayments({
        status: filter === "all" ? undefined : filter,
        limit: 100,
      }),
    refetchInterval: LIST_REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  });

  const isRefreshing =
    (summaryQuery.isFetching && !summaryQuery.isLoading) ||
    (listQuery.isFetching && !listQuery.isLoading);

  return (
    <PageShell
      title="Payments"
      description="What's outstanding for your trips and what's been paid."
      actions={
        <button
          type="button"
          onClick={() => {
            void summaryQuery.refetch();
            void listQuery.refetch();
          }}
          disabled={summaryQuery.isFetching || listQuery.isFetching}
          title={isRefreshing ? "Updating…" : "Refresh"}
          aria-label="Refresh"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      }
    >
      {/* Summary tiles */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryTile
          label="Total outstanding"
          value={summaryQuery.data?.totalOutstanding}
          subtitle={
            summaryQuery.data
              ? `${summaryQuery.data.countOutstanding} open ${summaryQuery.data.countOutstanding === 1 ? "invoice" : "invoices"}`
              : undefined
          }
          tone="amber"
          icon={<Wallet className="size-4" />}
        />
        <SummaryTile
          label="Overdue"
          value={summaryQuery.data?.totalOverdue}
          subtitle={
            summaryQuery.data
              ? `${summaryQuery.data.countOverdue} ${summaryQuery.data.countOverdue === 1 ? "invoice" : "invoices"}`
              : undefined
          }
          tone="red"
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      {/* Filter chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {listQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : listQuery.isError ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {listQuery.error instanceof Error ? listQuery.error.message : "Unable to load payments"}
          </CardContent>
        </Card>
      ) : (listQuery.data?.items.length ?? 0) === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <>
          <DesktopTable items={listQuery.data?.items ?? []} />
          <MobileList items={listQuery.data?.items ?? []} />
          {listQuery.data ? (
            <p className="mt-2 text-right text-[11px] text-muted-foreground">
              Showing {listQuery.data.items.length} of {listQuery.data.total}
            </p>
          ) : null}
        </>
      )}
    </PageShell>
  );
}

function SummaryTile({
  label,
  value,
  subtitle,
  tone,
  icon,
}: {
  label: string;
  value: number | undefined;
  subtitle?: string;
  tone: "amber" | "red";
  icon: React.ReactNode;
}) {
  const toneClass = {
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900">
              {value != null ? formatCurrency(value) : "—"}
            </p>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <span className={cn("flex size-8 items-center justify-center rounded-md", toneClass)}>
            {icon}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DesktopTable({ items }: { items: PortalReceivable[] }) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white sm:block">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Trip</th>
              <th className="px-4 py-2.5 text-left font-medium">Route</th>
              <th className="px-4 py-2.5 text-left font-medium">Due date</th>
              <th className="px-4 py-2.5 text-right font-medium">Invoice</th>
              <th className="px-4 py-2.5 text-right font-medium">Paid</th>
              <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 align-top">
                  {r.tripId ? (
                    <Link
                      href={`/trips/${r.tripId}`}
                      className="font-medium text-gray-900 hover:text-primary"
                    >
                      {r.tripNumber ?? "—"}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-900">{r.tripNumber ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top text-gray-700">
                  {formatRoute(r.pickupCity, r.deliveryCity)}
                </td>
                <td className="px-4 py-3 align-top text-gray-600">
                  {formatDate(r.dueDate)}
                </td>
                <td className="px-4 py-3 align-top text-right text-gray-900">
                  {formatCurrency(r.invoiceAmount)}
                </td>
                <td className="px-4 py-3 align-top text-right text-emerald-700">
                  {r.amountReceived > 0 ? formatCurrency(r.amountReceived) : "—"}
                </td>
                <td className="px-4 py-3 align-top text-right font-semibold text-amber-700">
                  {formatCurrency(r.amountOutstanding)}
                </td>
                <td className="px-4 py-3 align-top">
                  <StatusPill status={r.status as ReceivableStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileList({ items }: { items: PortalReceivable[] }) {
  return (
    <div className="space-y-2 sm:hidden">
      {items.map((r) => {
        const Wrap = r.tripId
          ? (props: { children: React.ReactNode }) => (
              <Link href={`/trips/${r.tripId}`} className="block">
                {props.children}
              </Link>
            )
          : (props: { children: React.ReactNode }) => <div>{props.children}</div>;
        return (
          <Wrap key={r.id}>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {r.tripNumber ?? "—"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-700">
                    {formatRoute(r.pickupCity, r.deliveryCity)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Due {formatDate(r.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusPill status={r.status as ReceivableStatus} />
                  {r.tripId ? <ChevronRight className="size-4 text-gray-300" /> : null}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                <span className="text-muted-foreground">
                  Paid{" "}
                  <span className="text-emerald-700">
                    {r.amountReceived > 0 ? formatCurrency(r.amountReceived) : "—"}
                  </span>
                </span>
                <span className="font-semibold text-amber-700">
                  {formatCurrency(r.amountOutstanding)} due
                </span>
              </div>
            </div>
          </Wrap>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: ReceivableStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        STATUS_TONE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function EmptyState({ filter }: { filter: ReceivableStatus | "all" }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-gray-900">
          {filter === "all" ? "All clear" : "Nothing matches this filter"}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {filter === "all"
            ? "You don't have any pending payments. Invoices will appear here once trips are billed."
            : "Try a different filter or check back later."}
        </p>
      </CardContent>
    </Card>
  );
}
