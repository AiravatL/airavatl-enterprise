import { tripStatusLabel, tripStatusToneClass } from "@/lib/format/trip-status";
import { cn } from "@/lib/utils";
import type { TripStatus } from "@/lib/api/portal-trips";

interface Props {
  status: TripStatus | string;
  className?: string;
}

export function TripStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        tripStatusToneClass(status),
        className,
      )}
    >
      {tripStatusLabel(status)}
    </span>
  );
}
