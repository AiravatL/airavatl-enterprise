import { DashboardView } from "./dashboard-view";
import { getCurrentPortalAccount } from "@/lib/api/portal-account";

export default async function DashboardPage() {
  const account = await getCurrentPortalAccount();
  return <DashboardView firstName={account?.fullName?.split(" ")[0] ?? null} />;
}
