"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRequest } from "@/lib/api/portal-requests";
import type { PlaceDetails } from "@/lib/api/maps";
import { Save, X, Loader2 } from "lucide-react";
import { PageShell } from "../../_components/page-shell";
import { LocationPicker } from "./location-picker";

const CARGO_TYPES: { value: string; label: string }[] = [
  { value: "general", label: "General" },
  { value: "fragile", label: "Fragile" },
  { value: "perishable", label: "Perishable" },
  { value: "hazardous", label: "Hazardous" },
  { value: "oversized", label: "Oversized" },
  { value: "liquid", label: "Liquid" },
  { value: "electronics", label: "Electronics" },
];

type WeightUnit = "ton" | "kg";

export function NewRequestView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const sessionToken = useMemo(() => crypto.randomUUID(), []);

  const [pickup, setPickup] = useState<PlaceDetails | null>(null);
  const [delivery, setDelivery] = useState<PlaceDetails | null>(null);

  const [cargoDescription, setCargoDescription] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("ton");
  const [cargoType, setCargoType] = useState("general");
  const [specialInstructions, setSpecialInstructions] = useState("");

  const [preferredPickupDate, setPreferredPickupDate] = useState("");
  const [preferredPickupTime, setPreferredPickupTime] = useState("");
  const [notes, setNotes] = useState("");

  const cargoWeightKg = cargoWeight
    ? Math.round(weightUnit === "ton" ? Number(cargoWeight) * 1000 : Number(cargoWeight))
    : undefined;

  const preferredPickupAt = preferredPickupDate
    ? new Date(`${preferredPickupDate}T${preferredPickupTime || "08:00"}:00`).toISOString()
    : undefined;

  const isValid =
    pickup !== null &&
    delivery !== null &&
    cargoDescription.trim() !== "";

  const createMutation = useMutation({
    mutationFn: () =>
      createRequest({
        pickupAddress: pickup!.formattedAddress,
        pickupCity: pickup!.city || undefined,
        pickupState: pickup!.state ?? undefined,
        pickupLatitude: pickup!.latitude,
        pickupLongitude: pickup!.longitude,
        pickupPlaceId: pickup!.placeId,
        deliveryAddress: delivery!.formattedAddress,
        deliveryCity: delivery!.city || undefined,
        deliveryState: delivery!.state ?? undefined,
        deliveryLatitude: delivery!.latitude,
        deliveryLongitude: delivery!.longitude,
        deliveryPlaceId: delivery!.placeId,
        cargoDescription: cargoDescription.trim(),
        cargoWeightKg: cargoWeightKg && cargoWeightKg > 0 ? cargoWeightKg : undefined,
        cargoType,
        specialInstructions: specialInstructions.trim() || undefined,
        preferredPickupAt,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["portal-requests"] });
      router.push(`/requests/${result.id}`);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Failed to submit request"),
  });

  return (
    <PageShell
      title="New Trip Request"
      description="Tell us where to pick up, where to drop, and what's being shipped"
    >
      <Card className="p-4 sm:p-6 max-w-3xl">
        <div className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <Section title="Pickup">
            <LocationPicker label="Pickup Address" required value={pickup}
              sessionToken={sessionToken} onSelect={setPickup} onClear={() => setPickup(null)} />
          </Section>

          <Section title="Delivery">
            <LocationPicker label="Delivery Address" required value={delivery}
              sessionToken={sessionToken} onSelect={setDelivery} onClear={() => setDelivery(null)} />
          </Section>

          <Section title="Cargo">
            <div className="space-y-3">
              <Field label="Description" required>
                <Input
                  value={cargoDescription} maxLength={300}
                  onChange={(e) => setCargoDescription(e.target.value.slice(0, 300))}
                  placeholder="e.g. Steel coils, 5 boxes of electronics…"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Weight">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text" inputMode="decimal"
                      placeholder={weightUnit === "ton" ? "e.g. 5" : "e.g. 5000"}
                      value={cargoWeight}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.]/g, "");
                        setCargoWeight(v.slice(0, 8));
                      }}
                      className="flex-1"
                    />
                    <div className="flex rounded-md border border-gray-200 overflow-hidden shrink-0">
                      <button type="button"
                        className={`px-2.5 py-1.5 text-xs font-medium ${weightUnit === "ton" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                        onClick={() => setWeightUnit("ton")}>Ton</button>
                      <button type="button"
                        className={`px-2.5 py-1.5 text-xs font-medium ${weightUnit === "kg" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                        onClick={() => setWeightUnit("kg")}>Kg</button>
                    </div>
                  </div>
                </Field>
                <Field label="Type">
                  <select
                    value={cargoType}
                    onChange={(e) => setCargoType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CARGO_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Special Instructions">
                <textarea
                  rows={2} maxLength={500}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value.slice(0, 500))}
                  placeholder="Any handling instructions…"
                  className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>
          </Section>

          <Section title="Preferred schedule & notes (optional)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Preferred pickup date">
                <Input type="date" value={preferredPickupDate}
                  onChange={(e) => setPreferredPickupDate(e.target.value)} />
              </Field>
              <Field label="Preferred pickup time">
                <Input type="time" value={preferredPickupTime}
                  onChange={(e) => setPreferredPickupTime(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Notes for our ops team">
                <textarea
                  rows={2} maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  placeholder="Anything we should know…"
                  className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>
          </Section>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => router.push("/requests")}
              disabled={createMutation.isPending}
            >
              <X className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
            <Button
              onClick={() => {
                if (!isValid) return;
                setError("");
                createMutation.mutate();
              }}
              disabled={!isValid || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Submit Request
            </Button>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}
