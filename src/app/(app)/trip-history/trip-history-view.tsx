"use client";

import { TripsTable } from "@/components/trips/trips-table";
import { PageShell } from "../_components/page-shell";

export function TripHistoryView() {
  return (
    <PageShell title="Trip History" description="Completed and cancelled trips">
      <TripsTable
        scope="history"
        emptyTitle="No trip history yet"
        emptyDescription="Once your trips complete or close, they'll show up here with full details."
      />
    </PageShell>
  );
}
