"use client";

import { createContext, use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addHoldingCharge,
  cancelTrip,
  deleteHoldingCharge,
  getTripOps,
  recordTripPayment,
  reviewTripProof,
  type TripOps,
} from "@/lib/api/portal-trip-ops";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import {
  Settings2, CheckCircle2, XCircle, Loader2, Wallet, Clock4, Trash2, Ban, ShieldCheck,
} from "lucide-react";

const TERMINAL = ["completed", "cancelled", "driver_rejected"];

// Shared state for the operational sections. Lifting it into a context lets
// each section (ProofReview, PaymentSection, …) consume exactly what it needs
// without re-drilling the same four props through every call site.
interface TripOpsContextValue {
  ops: TripOps;
  tripId: string;
  onDone: () => void;
  setError: (message: string) => void;
}

const TripOpsContext = createContext<TripOpsContextValue | null>(null);

function useTripOpsContext(): TripOpsContextValue {
  const ctx = use(TripOpsContext);
  if (!ctx) throw new Error("Trip-ops sections must render inside <EnterpriseTripOps>");
  return ctx;
}

export function EnterpriseTripOps({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["portal-trip-ops", tripId],
    queryFn: () => getTripOps(tripId),
    refetchInterval: (q) => (q.state.data && TERMINAL.includes(q.state.data.status) ? false : 20_000),
  });

  const ops = query.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["portal-trip-ops", tripId] });
    queryClient.invalidateQueries({ queryKey: ["portal-trip", tripId] });
  };

  if (!ops || !ops.isEnterprise) return null; // only render for your own enterprise trips

  return (
    <Card className="border-violet-200">
      <CardContent className="p-3 sm:p-4 space-y-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-800">
          <Settings2 className="size-3.5" /> You operate this trip
          <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">Enterprise</span>
        </div>

        {error && <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <TripOpsContext value={{ ops, tripId, onDone: invalidate, setError }}>
          <ProofReview />
          <PaymentSection />
          <HoldingSection />
          <CancelSection />
        </TripOpsContext>
      </CardContent>
    </Card>
  );
}

// ─── Proof review ────────────────────────────────────────────────────────────
function ProofReview() {
  const { ops, tripId, onDone, setError } = useTripOpsContext();
  const reviewable = ops.proofs.filter(
    (p) => (p.proofType === "loading" || p.proofType === "pod") &&
      (p.reviewStatus === "pending" || p.reviewStatus == null),
  );
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (v: { proofId: string; action: "accept" | "reject"; reason?: string }) =>
      reviewTripProof(tripId, v.proofId, v.action, v.reason),
    onSuccess: () => { setRejecting(null); setReason(""); onDone(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't review proof"),
  });

  if (reviewable.length === 0) return null;
  const label = (t: string) => (t === "loading" ? "Loading proof" : t === "pod" ? "Proof of delivery" : t);

  return (
    <Section icon={<ShieldCheck className="size-3.5" />} title="Proofs awaiting your review">
      <div className="space-y-2">
        {reviewable.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50/60 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900">{label(p.proofType)}</p>
              <p className="text-[10px] text-muted-foreground truncate">{p.fileName ?? "Uploaded by driver"}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { setError(""); setRejecting(p.id); setReason(""); }} disabled={mutation.isPending}>
                <XCircle className="size-3.5 mr-1" /> Reject
              </Button>
              <Button size="sm" className="h-7"
                onClick={() => { setError(""); mutation.mutate({ proofId: p.id, action: "accept" }); }}
                disabled={mutation.isPending}>
                <CheckCircle2 className="size-3.5 mr-1" /> Accept
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject proof</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Tell the driver what to fix — they&apos;ll be asked to re-upload.</p>
          <textarea rows={3} value={reason} maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Photo is blurry / wrong document"
            className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={mutation.isPending}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700"
              disabled={mutation.isPending || reason.trim() === ""}
              onClick={() => rejecting && mutation.mutate({ proofId: rejecting, action: "reject", reason: reason.trim() })}>
              {mutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <XCircle className="size-4 mr-1.5" />}
              Reject &amp; notify driver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

// ─── Payments ────────────────────────────────────────────────────────────────
function PaymentSection() {
  const { ops, tripId, onDone, setError } = useTripOpsContext();
  const showAdvance = ops.status === "waiting_for_advance";
  const showFinal = ops.status === "waiting_for_final";
  // Advance counts toward what's recorded whether it's settled or deferred.
  const advanceRecorded = ops.payments
    .filter((p) => p.type === "advance" && (p.status === "completed" || p.status === "pending"))
    .reduce((s, p) => s + p.amount, 0);
  const finalDue = Math.max((ops.driverBidAmount ?? 0) - advanceRecorded, 0);

  const [advanceAmount, setAdvanceAmount] = useState("");
  const [reference, setReference] = useState("");

  const mutation = useMutation({
    mutationFn: (v: { type: "advance" | "final"; defer: boolean }) =>
      recordTripPayment(tripId, {
        paymentType: v.type,
        amount: v.type === "advance" ? Number(advanceAmount) : undefined,
        reference: reference.trim() || undefined,
        defer: v.defer,
      }),
    onSuccess: () => { setAdvanceAmount(""); setReference(""); onDone(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't record payment"),
  });

  const advanceInvalid = !advanceAmount || Number(advanceAmount) <= 0;

  return (
    <Section icon={<Wallet className="size-3.5" />} title="Driver payments">
      {ops.payments.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {ops.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md bg-gray-50 px-2.5 py-1.5 text-xs">
              <span className="capitalize text-gray-700">{p.type}{p.reference ? ` · ${p.reference}` : ""}</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(p.amount)}
                <span className={`ml-1.5 text-[10px] font-normal ${p.status === "pending" ? "text-amber-600" : "text-emerald-600"}`}>
                  {p.status === "pending" ? "pay later" : "paid"}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {showAdvance && (
        <div className="rounded-md border border-gray-200 p-2.5 space-y-2">
          <p className="text-xs font-medium text-gray-900">Advance to driver</p>
          <p className="text-[11px] text-muted-foreground">
            Driver&apos;s amount: <span className="font-medium">{formatCurrency(ops.driverBidAmount)}</span>. You pay them directly.
          </p>
          <Input inputMode="decimal" placeholder="Advance amount (₹)" value={advanceAmount}
            onChange={(e) => setAdvanceAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))} />
          <Input placeholder="Reference / UTR (optional)" value={reference} maxLength={120}
            onChange={(e) => setReference(e.target.value)} />
          <PayButtons
            disabled={mutation.isPending || advanceInvalid}
            pending={mutation.isPending}
            onPayNow={() => { setError(""); mutation.mutate({ type: "advance", defer: false }); }}
            onPayLater={() => { setError(""); mutation.mutate({ type: "advance", defer: true }); }}
          />
          <p className="text-[10px] text-muted-foreground">
            Either option starts the delivery. &ldquo;Pay later&rdquo; is tracked on the Payments page.
          </p>
        </div>
      )}

      {showFinal && (
        <div className="rounded-md border border-gray-200 p-2.5 space-y-2">
          <p className="text-xs font-medium text-gray-900">Final payment to driver</p>
          <p className="text-[11px] text-muted-foreground">
            Remaining due: <span className="font-semibold text-gray-900">{formatCurrency(finalDue)}</span>
          </p>
          <Input placeholder="Reference / UTR (optional)" value={reference} maxLength={120}
            onChange={(e) => setReference(e.target.value)} />
          <PayButtons
            disabled={mutation.isPending || finalDue <= 0}
            pending={mutation.isPending}
            onPayNow={() => { setError(""); mutation.mutate({ type: "final", defer: false }); }}
            onPayLater={() => { setError(""); mutation.mutate({ type: "final", defer: true }); }}
          />
          <p className="text-[10px] text-muted-foreground">
            Either option completes the trip. &ldquo;Pay later&rdquo; is tracked on the Payments page.
          </p>
        </div>
      )}

      {!showAdvance && !showFinal && ops.payments.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Payment actions appear once you&apos;ve accepted the loading proof (advance) and the POD (final).
        </p>
      )}
    </Section>
  );
}

function PayButtons({ disabled, pending, onPayNow, onPayLater }: {
  disabled: boolean; pending: boolean; onPayNow: () => void; onPayLater: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button size="sm" disabled={disabled} onClick={onPayNow}>
        {pending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Wallet className="size-4 mr-1.5" />}
        Pay now
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onPayLater}>
        <Clock4 className="size-4 mr-1.5" /> Pay later
      </Button>
    </div>
  );
}

// ─── Holding charges ─────────────────────────────────────────────────────────
function HoldingSection() {
  const { ops, tripId, onDone, setError } = useTripOpsContext();
  const canManage = !TERMINAL.includes(ops.status) && !ops.finalPaidAt;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const addMutation = useMutation({
    mutationFn: () => addHoldingCharge(tripId, { driverAmount: Number(amount), note: note.trim() || undefined }),
    onSuccess: () => { setAmount(""); setNote(""); onDone(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't add charge"),
  });
  const delMutation = useMutation({
    mutationFn: (id: string) => deleteHoldingCharge(tripId, id),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't delete charge"),
  });

  if (ops.holdingCharges.length === 0 && !canManage) return null;

  return (
    <Section icon={<Clock4 className="size-3.5" />} title="Holding / detention charges">
      {ops.holdingCharges.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {ops.holdingCharges.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md bg-gray-50 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 truncate text-gray-700">
                {formatCurrency(c.driverAmount)}{c.note ? ` · ${c.note}` : ""}
              </span>
              {canManage && (
                <button type="button" className="text-gray-400 hover:text-red-600 shrink-0"
                  onClick={() => { setError(""); delMutation.mutate(c.id); }} disabled={delMutation.isPending}>
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          <p className="text-right text-[11px] font-medium text-gray-700">
            Total: {formatCurrency(ops.holdingDriverTotal)}
          </p>
        </div>
      )}
      {canManage && (
        <div className="flex gap-1.5">
          <Input inputMode="decimal" placeholder="Amount (₹)" value={amount} className="w-28"
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))} />
          <Input placeholder="Note (optional)" value={note} maxLength={200}
            onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="outline" className="shrink-0"
            disabled={addMutation.isPending || !amount || Number(amount) <= 0}
            onClick={() => { setError(""); addMutation.mutate(); }}>
            {addMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
          </Button>
        </div>
      )}
    </Section>
  );
}

// ─── Cancel ──────────────────────────────────────────────────────────────────
function CancelSection() {
  const { ops, tripId, onDone, setError } = useTripOpsContext();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => cancelTrip(tripId, reason.trim()),
    onSuccess: () => { setOpen(false); setReason(""); onDone(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't cancel trip"),
  });

  if (TERMINAL.includes(ops.status)) return null;

  return (
    <div className="border-t border-gray-100 pt-3">
      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => { setError(""); setOpen(true); }}>
        <Ban className="size-3.5 mr-1.5" /> Cancel trip
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel this trip?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">The driver will be notified. This can&apos;t be undone.</p>
          <textarea rows={3} value={reason} maxLength={300}
            onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancellation"
            className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>Keep trip</Button>
            <Button className="bg-red-600 hover:bg-red-700"
              disabled={mutation.isPending || reason.trim() === ""}
              onClick={() => mutation.mutate()}>
              {mutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Ban className="size-4 mr-1.5" />}
              Cancel trip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">{icon}{title}</div>
      {children}
    </div>
  );
}
