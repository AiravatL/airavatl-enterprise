"use client";

import { TripsTable } from "@/components/trips/trips-table";
import { PageShell } from "../_components/page-shell";

export function ActiveTripsView() {
  return (
    <PageShell title="Active Trips" description="Trips currently in progress">
      <TripsTable
        scope="active"
        emptyTitle="No active trips"
        emptyDescription="Trips will appear here in real time once they're dispatched."
      />
    </PageShell>
  );
}
