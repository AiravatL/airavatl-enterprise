"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Wallet, Clock4 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listPendingPayments,
  settleTripPayments,
  type PendingPayment,
} from "@/lib/api/portal-payments";
import { formatCurrency } from "@/lib/format";
import { PageShell } from "../_components/page-shell";

const REFETCH_MS = 60_000;

interface TripGroup {
  tripId: string;
  tripNumber: string;
  pickupCity: string | null;
  deliveryCity: string | null;
  bidAmount: number;
  advance: PendingPayment | null;
  final: PendingPayment | null;
  others: PendingPayment[];
  total: number;
}

function groupByTrip(items: PendingPayment[]): TripGroup[] {
  const map = new Map<string, TripGroup>();
  for (const p of items) {
    let g = map.get(p.tripId);
    if (!g) {
      g = {
        tripId: p.tripId, tripNumber: p.tripNumber,
        pickupCity: p.pickupCity, deliveryCity: p.deliveryCity,
        bidAmount: p.bidAmount, advance: null, final: null, others: [], total: 0,
      };
      map.set(p.tripId, g);
    }
    if (p.type === "advance") g.advance = p;
    else if (p.type === "final") g.final = p;
    else g.others.push(p);
    g.total += p.amount;
  }
  return [...map.values()];
}

export function PaymentsView() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [settleTrip, setSettleTrip] = useState<TripGroup | null>(null);

  const query = useQuery({
    queryKey: ["portal-pending-payments"] as const,
    queryFn: () => listPendingPayments({ limit: 200 }),
    staleTime: 30_000,
    refetchInterval: REFETCH_MS,
    placeholderData: keepPreviousData,
  });

  const groups = useMemo(() => groupByTrip(query.data?.items ?? []), [query.data]);
  const totalAmount = query.data?.totalAmount ?? 0;

  return (
    <PageShell
      title="Payments"
      description="Driver payments you marked “pay later” — settle them here."
    >
      {error && <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="mb-4">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total pending</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Clock4 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : query.isError ? (
        <Card><CardContent className="p-4 text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : "Failed to load"}
        </CardContent></Card>
      ) : groups.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300 mb-2" />
          <p className="text-sm text-gray-600">No pending payments</p>
          <p className="text-xs text-gray-400 mt-1">Everything you owe drivers is settled.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <TripCard key={g.tripId} group={g} onPay={() => { setError(""); setSettleTrip(g); }} />
          ))}
        </div>
      )}

      <SettleDialog
        group={settleTrip}
        onClose={() => setSettleTrip(null)}
        onSettled={() => {
          setSettleTrip(null);
          queryClient.invalidateQueries({ queryKey: ["portal-pending-payments"] });
        }}
        onError={setError}
      />
    </PageShell>
  );
}

function TripCard({ group, onPay }: { group: TripGroup; onPay: () => void }) {
  const both = group.advance && group.final;
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/trips/${group.tripId}`} className="text-sm font-medium text-primary hover:underline">
              {group.tripNumber}
            </Link>
            <p className="truncate text-xs text-gray-500">
              {(group.pickupCity ?? "—")} → {(group.deliveryCity ?? "—")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.advance && <Pill label="Advance" amount={group.advance.amount} />}
              {group.final && <Pill label="Final" amount={group.final.amount} />}
              {group.others.map((o) => <Pill key={o.id} label={o.type} amount={o.amount} />)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-gray-900">{formatCurrency(group.total)}</p>
            {both && <p className="text-[10px] text-gray-400">advance + final</p>}
            <Button size="sm" className="mt-1.5 h-8" onClick={onPay}>
              <Wallet className="size-4 mr-1.5" /> Mark paid
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Pill({ label, amount }: { label: string; amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
      <span className="capitalize">{label}</span>
      <span className="font-medium">{formatCurrency(amount)}</span>
    </span>
  );
}

function SettleDialog({ group, onClose, onSettled, onError }: {
  group: TripGroup | null;
  onClose: () => void;
  onSettled: () => void;
  onError: (s: string) => void;
}) {
  const hasAdvance = !!group?.advance;
  const hasFinal = !!group?.final;
  const [advanceStr, setAdvanceStr] = useState("");
  const [reference, setReference] = useState("");
  const [lastTripId, setLastTripId] = useState<string | null>(null);

  // Reset the form when a new trip's dialog opens.
  if (group && group.tripId !== lastTripId) {
    setLastTripId(group.tripId);
    setAdvanceStr(group.advance ? String(group.advance.amount) : "");
    setReference("");
  }

  const mutation = useMutation({
    mutationFn: () =>
      settleTripPayments(group!.tripId, {
        advanceAmount: hasAdvance ? Number(advanceStr) : undefined,
        reference: reference.trim() || undefined,
      }),
    onSuccess: onSettled,
    onError: (e) => onError(e instanceof Error ? e.message : "Couldn't settle payments"),
  });

  if (!group) return null;

  const advanceVal = hasAdvance ? Number(advanceStr) : 0;
  const finalVal = hasFinal
    ? hasAdvance
      ? Math.max(group.bidAmount - advanceVal, 0)
      : (group.final?.amount ?? 0)
    : 0;
  const othersTotal = group.others.reduce((s, o) => s + o.amount, 0);
  const total = advanceVal + finalVal + othersTotal;
  const advanceInvalid = hasAdvance && (!advanceStr || advanceVal <= 0 || advanceVal > group.bidAmount);
  const finalInvalid = hasAdvance && hasFinal && finalVal <= 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark trip {group.tripNumber} paid</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {hasAdvance && (
            <div className="space-y-1">
              <Label className="text-sm font-medium">Advance amount</Label>
              <Input inputMode="decimal" value={advanceStr}
                onChange={(e) => setAdvanceStr(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))} />
              <p className="text-[11px] text-gray-400">
                Driver&apos;s total: {formatCurrency(group.bidAmount)}.
              </p>
            </div>
          )}
          {hasFinal && (
            <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-600">Final payment</span>
              <span className="font-medium text-gray-900">{formatCurrency(finalVal)}</span>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Reference / UTR (optional)</Label>
            <Input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium text-primary">Paying now</span>
            <span className="text-base font-bold text-primary">{formatCurrency(total)}</span>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button
              disabled={mutation.isPending || advanceInvalid || finalInvalid}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Wallet className="size-4 mr-1.5" />}
              Mark paid
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
