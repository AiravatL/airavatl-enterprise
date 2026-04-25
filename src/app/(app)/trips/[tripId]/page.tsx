import { TripDetailView } from "./trip-detail-view";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function TripDetailPage({ params }: Props) {
  const { tripId } = await params;
  return <TripDetailView tripId={tripId} />;
}
