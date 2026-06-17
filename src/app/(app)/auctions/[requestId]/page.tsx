import { AuctionDetailView } from "./auction-detail-view";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <AuctionDetailView requestId={requestId} />;
}
