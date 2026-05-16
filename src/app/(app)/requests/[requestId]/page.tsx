import { RequestDetailView } from "./request-detail-view";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <RequestDetailView requestId={requestId} />;
}
