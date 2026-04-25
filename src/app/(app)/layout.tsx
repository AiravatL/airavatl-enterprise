import { redirect } from "next/navigation";

import { AuthInit } from "@/lib/auth/auth-context";
import { getCurrentPortalAccount } from "@/lib/api/portal-account";
import { AppShell } from "./_components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentPortalAccount();

  if (!account) {
    // Caller has a Supabase session cookie but no portal access (revoked,
    // never granted, or stale cookie). Server Components can't clear cookies,
    // so we hop through a Route Handler that signs out and redirects to /login.
    redirect("/api/auth/clear?reason=no_portal_access");
  }

  return (
    <AuthInit>
      <AppShell account={account}>{children}</AppShell>
    </AuthInit>
  );
}
