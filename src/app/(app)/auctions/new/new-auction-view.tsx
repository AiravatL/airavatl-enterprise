"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAuction,
  listVehicleTypes,
  type VehicleMasterType,
} from "@/lib/api/portal-auctions";
import type { PlaceDetails } from "@/lib/api/maps";
import { takeDraftLocations } from "@/lib/auction-draft";
import {
  ArrowLeft, ArrowRight, MapPin, Loader2, Gavel, ArrowDownUp,
  Truck, Container, Check, ChevronDown, Package, Clock,
} from "lucide-react";
import { LocationPicker } from "../../requests/new/location-picker";

// Mirrors the consigner mobile app's 5-step create-auction flow.
const STEPS = ["Locations", "Material", "Vehicle", "Schedule", "Auction"] as const;
type WeightUnit = "ton" | "kg";
type LengthUnit = "feet" | "meter";
type BodyType = "open" | "container";

const DURATION_PRESETS = [
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "1 day" },
];

function vehicleSpec(v: VehicleMasterType) {
  const bits: string[] = [];
  if (v.capacityTons != null) bits.push(`${v.capacityTons}T`);
  if (v.lengthFeet != null) bits.push(`${v.lengthFeet} ft`);
  if (v.wheelCount != null) bits.push(`${v.wheelCount} wheel`);
  return bits.length ? bits.join(" · ") : v.name;
}

export function NewAuctionView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionToken = useMemo(() => crypto.randomUUID(), []);
  // Locations may already be chosen on the location-first home screen — if so,
  // prefill them and jump straight to the Material step.
  const draft = useMemo(() => takeDraftLocations(), []);
  const [step, setStep] = useState(draft?.pickup && draft?.delivery ? 1 : 0);
  const [error, setError] = useState("");

  // Step 1 — locations
  const [pickup, setPickup] = useState<PlaceDetails | null>(draft?.pickup ?? null);
  const [delivery, setDelivery] = useState<PlaceDetails | null>(draft?.delivery ?? null);

  // Step 2 — material
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("ton");
  const [cargoLength, setCargoLength] = useState("");
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>("feet");
  const [fragile, setFragile] = useState(false);
  const [refrigeration, setRefrigeration] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [reqOpen, setReqOpen] = useState(false);

  // Step 3 — vehicle
  const [bodyType, setBodyType] = useState<BodyType>("open");
  const [vehicleTypeId, setVehicleTypeId] = useState("");
  const [showAllVehicles, setShowAllVehicles] = useState(false);

  // Step 4 — schedule & contacts
  const [consignmentDate, setConsignmentDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [pickupContactName, setPickupContactName] = useState("");
  const [pickupContactPhone, setPickupContactPhone] = useState("");
  const [pickupContactOpen, setPickupContactOpen] = useState(false);
  const [sameContact, setSameContact] = useState(true);
  const [deliveryContactName, setDeliveryContactName] = useState("");
  const [deliveryContactPhone, setDeliveryContactPhone] = useState("");

  // Step 5 — auction duration
  const [auctionDuration, setAuctionDuration] = useState<number | null>(null);

  const vehicleTypesQuery = useQuery({
    queryKey: ["portal-vehicle-types"],
    queryFn: listVehicleTypes,
    staleTime: 10 * 60 * 1000,
  });

  const weightKg = weight
    ? Math.round(weightUnit === "ton" ? Number(weight) * 1000 : Number(weight))
    : undefined;

  const cargoLengthFeet = cargoLength
    ? lengthUnit === "feet"
      ? Number(cargoLength)
      : Number(cargoLength) * 3.28084
    : undefined;

  // Vehicle list — filtered by body type, smart-sorted (best fit first).
  const vehicles = useMemo(() => {
    const all = (vehicleTypesQuery.data ?? []).filter(
      (v) => (v.bodyType ?? "open").toLowerCase() === bodyType,
    );
    const fits = (v: VehicleMasterType) => {
      const capKg = v.capacityTons != null ? v.capacityTons * 1000 : Infinity;
      const lenOk = cargoLengthFeet == null || v.lengthFeet == null || v.lengthFeet >= cargoLengthFeet;
      return (weightKg == null || capKg >= weightKg) && lenOk;
    };
    return [...all].sort((a, b) => {
      const af = fits(a) ? 0 : 1;
      const bf = fits(b) ? 0 : 1;
      if (af !== bf) return af - bf;
      return (a.capacityTons ?? 0) - (b.capacityTons ?? 0);
    });
  }, [vehicleTypesQuery.data, bodyType, weightKg, cargoLengthFeet]);

  const visibleVehicles = showAllVehicles ? vehicles : vehicles.slice(0, 3);

  // Schedule → scheduled pickup datetime + auction duration constraint.
  const pickupIso = consignmentDate && pickupTime
    ? new Date(`${consignmentDate}T${pickupTime}:00`).toISOString()
    : undefined;

  const maxAuctionMinutes = useMemo(() => {
    if (!pickupIso) return 1440;
    const mins = Math.floor((new Date(pickupIso).getTime() - Date.now()) / 60000) - 30;
    return Math.max(0, Math.min(mins, 1440));
  }, [pickupIso]);

  const availablePresets = DURATION_PRESETS.filter((d) => d.value <= maxAuctionMinutes);

  // Step validity gates.
  const canNext = [
    pickup !== null && delivery !== null,
    description.trim() !== "" && (weightKg ?? 0) > 0,
    vehicleTypeId !== "",
    consignmentDate !== "" && pickupTime !== "",
    auctionDuration !== null && auctionDuration >= 5 && auctionDuration <= maxAuctionMinutes,
  ][step];

  const selectedVehicle = vehicles.find((v) => v.id === vehicleTypeId);

  const composedInstructions = useMemo(() => {
    const parts = [instructions.trim()];
    if (refrigeration) parts.push("Requires refrigeration / cold storage.");
    if (cargoLength) parts.push(`Cargo length: ${cargoLength} ${lengthUnit}.`);
    return parts.filter(Boolean).join(" ") || undefined;
  }, [instructions, refrigeration, cargoLength, lengthUnit]);

  const createMutation = useMutation({
    mutationFn: () =>
      createAuction({
        pickupAddress: pickup!.formattedAddress,
        pickupCity: pickup!.city || undefined,
        pickupState: pickup!.state ?? undefined,
        pickupLatitude: pickup!.latitude,
        pickupLongitude: pickup!.longitude,
        pickupPlaceId: pickup!.placeId,
        pickupPrimaryText: pickup!.primaryText || undefined,
        pickupSecondaryText: pickup!.secondaryText || undefined,
        pickupContactName: pickupContactName.trim() || undefined,
        pickupContactPhone: pickupContactPhone.trim() || undefined,
        deliveryAddress: delivery!.formattedAddress,
        deliveryCity: delivery!.city || undefined,
        deliveryState: delivery!.state ?? undefined,
        deliveryLatitude: delivery!.latitude,
        deliveryLongitude: delivery!.longitude,
        deliveryPlaceId: delivery!.placeId,
        deliveryPrimaryText: delivery!.primaryText || undefined,
        deliverySecondaryText: delivery!.secondaryText || undefined,
        deliveryContactName: (sameContact ? pickupContactName : deliveryContactName).trim() || undefined,
        deliveryContactPhone: (sameContact ? pickupContactPhone : deliveryContactPhone).trim() || undefined,
        vehicleMasterTypeId: vehicleTypeId,
        cargoDescription: description.trim(),
        cargoWeightKg: weightKg,
        cargoType: fragile ? "fragile" : refrigeration ? "perishable" : "general",
        specialInstructions: composedInstructions,
        consignmentDate: pickupIso!,
        scheduledPickupTime: pickupIso!,
        auctionDurationMinutes: auctionDuration!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-auctions"] });
      router.push("/auctions");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to publish auction"),
  });

  const goNext = () => {
    setError("");
    if (step < STEPS.length - 1) setStep(step + 1);
    else if (canNext) createMutation.mutate();
  };
  const goBack = () => {
    setError("");
    if (step > 0) setStep(step - 1);
    else router.push("/auctions");
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col">
      {/* Header + progress */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Step {step + 1} of {STEPS.length}</p>
            <h1 className="text-base font-semibold text-gray-900">{STEPS[step]}</h1>
          </div>
        </div>
        <div className="mt-2 flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* ── Step 1: Locations ── */}
        {step === 0 && (
          <div className="space-y-3">
            <LocationPicker label="Pickup location" required value={pickup}
              sessionToken={sessionToken} onSelect={setPickup} onClear={() => setPickup(null)} />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => { const p = pickup; setPickup(delivery); setDelivery(p); }}
                disabled={!pickup && !delivery}
                className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 shadow-sm hover:bg-gray-50 disabled:opacity-40"
                title="Swap pickup & drop"
              >
                <ArrowDownUp className="h-4 w-4" />
              </button>
            </div>
            <LocationPicker label="Drop location" required value={delivery}
              sessionToken={sessionToken} onSelect={setDelivery} onClear={() => setDelivery(null)} />
          </div>
        )}

        {/* ── Step 2: Material ── */}
        {step === 1 && (
          <div className="space-y-4">
            <Field label="Description" required>
              <textarea
                rows={3} maxLength={300} value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                placeholder="e.g. 50 cartons of electronics, furniture items…"
                className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Total weight" required>
              <div className="flex items-center gap-2">
                <Input type="text" inputMode="decimal" className="flex-1"
                  placeholder={weightUnit === "ton" ? "e.g. 5" : "e.g. 5000"}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))} />
                <UnitToggle value={weightUnit} onChange={setWeightUnit}
                  options={[["ton", "Ton"], ["kg", "Kg"]]} />
              </div>
            </Field>
            <Field label="Cargo length (optional)">
              <div className="flex items-center gap-2">
                <Input type="text" inputMode="decimal" className="flex-1" placeholder="Max length of items"
                  value={cargoLength}
                  onChange={(e) => setCargoLength(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))} />
                <UnitToggle value={lengthUnit} onChange={setLengthUnit}
                  options={[["feet", "Feet"], ["meter", "Meter"]]} />
              </div>
            </Field>

            <button type="button" onClick={() => setReqOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2.5 text-sm">
              <span className="font-medium text-gray-900">Special requirements</span>
              <span className="flex items-center gap-2 text-xs text-gray-400">
                {[fragile && "Fragile", refrigeration && "Cold", instructions && "Notes"].filter(Boolean).join(" · ") || "Optional"}
                <ChevronDown className={`h-4 w-4 transition-transform ${reqOpen ? "rotate-180" : ""}`} />
              </span>
            </button>
            {reqOpen && (
              <div className="space-y-3 rounded-md border border-gray-100 bg-gray-50/60 p-3">
                <Checkbox checked={fragile} onChange={setFragile} label="Fragile — handle with care" />
                <Checkbox checked={refrigeration} onChange={setRefrigeration} label="Requires refrigeration / cold storage" />
                <textarea rows={2} maxLength={400} value={instructions}
                  onChange={(e) => setInstructions(e.target.value.slice(0, 400))}
                  placeholder="Any special handling instructions…"
                  className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Vehicle ── */}
        {step === 2 && (
          <div className="space-y-4">
            <Field label="Body type" required>
              <div className="grid grid-cols-2 gap-2">
                {([["open", "Open Truck", Truck], ["container", "Container", Container]] as const).map(([v, label, Icon]) => (
                  <button key={v} type="button"
                    onClick={() => { setBodyType(v); setVehicleTypeId(""); setShowAllVehicles(false); }}
                    className={`flex items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium ${
                      bodyType === v ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600"
                    }`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Select vehicle" required>
              <p className="-mt-1 mb-1 text-[11px] text-gray-400">
                {weightKg ? "Best matches for your cargo first" : "Sorted by capacity (smallest first)"}
              </p>
              {vehicleTypesQuery.isLoading ? (
                <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></div>
              ) : (
                <div className="space-y-2">
                  {visibleVehicles.map((v) => {
                    const active = v.id === vehicleTypeId;
                    return (
                      <button key={v.id} type="button" onClick={() => setVehicleTypeId(v.id)}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left ${
                          active ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"
                        }`}>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{vehicleSpec(v)}</p>
                          <p className="text-[11px] text-gray-500">{v.name}</p>
                        </div>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                  {vehicles.length > 3 && (
                    <button type="button" onClick={() => setShowAllVehicles((s) => !s)}
                      className="w-full text-center text-xs font-medium text-primary py-1">
                      {showAllVehicles ? "Show fewer" : `Show ${vehicles.length - 3} more options`}
                    </button>
                  )}
                </div>
              )}
            </Field>
          </div>
        )}

        {/* ── Step 4: Schedule & contacts ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Consignment date" required>
                <Input type="date" value={consignmentDate}
                  onChange={(e) => setConsignmentDate(e.target.value)} />
              </Field>
              <Field label="Pickup time" required>
                <Input type="time" value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)} />
              </Field>
            </div>

            <button type="button" onClick={() => setPickupContactOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2.5 text-sm">
              <span className="font-medium text-gray-900">Pickup contact (optional)</span>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${pickupContactOpen ? "rotate-180" : ""}`} />
            </button>
            {pickupContactOpen && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input placeholder="Contact name" maxLength={120} value={pickupContactName}
                  onChange={(e) => setPickupContactName(e.target.value)} />
                <Input placeholder="Phone" inputMode="tel" maxLength={20} value={pickupContactPhone}
                  onChange={(e) => setPickupContactPhone(e.target.value)} />
              </div>
            )}

            <div>
              <Checkbox checked={sameContact} onChange={setSameContact} label="Drop contact same as pickup" />
              {!sameContact && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input placeholder="Drop contact name" maxLength={120} value={deliveryContactName}
                    onChange={(e) => setDeliveryContactName(e.target.value)} />
                  <Input placeholder="Phone" inputMode="tel" maxLength={20} value={deliveryContactPhone}
                    onChange={(e) => setDeliveryContactPhone(e.target.value)} />
                </div>
              )}
            </div>
            <p className="rounded-md bg-primary/5 p-2.5 text-[11px] text-primary">
              Contacts are optional — the driver can reach you directly once assigned.
            </p>
          </div>
        )}

        {/* ── Step 5: Auction duration + review ── */}
        {step === 4 && (
          <div className="space-y-4">
            <Field label="Auction runs for" required>
              {pickupIso && (
                <p className="-mt-1 mb-1 rounded-md bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary">
                  Pickup at {new Date(pickupIso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} — auction must end ≥30 min before.
                </p>
              )}
              {availablePresets.length === 0 ? (
                <p className="text-xs text-red-600">Pickup is too soon to run an auction. Pick a later pickup time.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availablePresets.map((d) => (
                    <button key={d.value} type="button" onClick={() => setAuctionDuration(d.value)}
                      className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-sm ${
                        auctionDuration === d.value ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-700"
                      }`}>
                      <span className="font-medium">{d.label}</span>
                      {auctionDuration === d.value && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            {/* Summary */}
            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-900">Review</p>
              <SummaryRow icon={<MapPin className="h-3.5 w-3.5 text-green-600" />} label="From"
                value={pickup?.primaryText || pickup?.formattedAddress || "—"} />
              <SummaryRow icon={<MapPin className="h-3.5 w-3.5 text-red-600" />} label="To"
                value={delivery?.primaryText || delivery?.formattedAddress || "—"} />
              <SummaryRow icon={<Package className="h-3.5 w-3.5 text-gray-400" />} label="Material"
                value={[description, weightKg ? `${weightKg} kg` : null].filter(Boolean).join(" · ")} />
              <SummaryRow icon={<Truck className="h-3.5 w-3.5 text-gray-400" />} label="Vehicle"
                value={selectedVehicle ? vehicleSpec(selectedVehicle) : "—"} />
              <SummaryRow icon={<Clock className="h-3.5 w-3.5 text-gray-400" />} label="Pickup"
                value={pickupIso ? new Date(pickupIso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA — sits at the base of the centered column */}
      <div className="sticky bottom-0 border-t border-gray-100 bg-white p-3">
        <Button className="w-full h-11" disabled={!canNext || createMutation.isPending}
          onClick={goNext}>
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : step === STEPS.length - 1 ? (
            <Gavel className="h-4 w-4 mr-1.5" />
          ) : null}
          {step === STEPS.length - 1 ? "Publish Auction" : (
            <>Next: {STEPS[step + 1]} <ArrowRight className="h-4 w-4 ml-1.5" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function UnitToggle<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: [T, string][];
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-gray-200">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-xs font-medium ${value === v ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm text-gray-700">
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-white" : "border-gray-300"}`}>
        {checked && <Check className="h-3 w-3" />}
      </span>
      {label}
    </button>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-[11px] text-gray-400 w-16 shrink-0">{label}</span>
      <span className="text-xs text-gray-800 truncate">{value || "—"}</span>
    </div>
  );
}
