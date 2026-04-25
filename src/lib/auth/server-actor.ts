import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PortalAccount } from "@/lib/api/portal-account";

interface PortalAccountRow {
  id: string;
  customer_id: string;
  customer_name: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  last_login_at: string | null;
}

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

interface PortalActorContext {
  supabase: SupabaseClient;
  account: PortalAccount;
}

interface PortalActorError {
  error: NextResponse;
}

/**
 * Resolves the calling user's portal account for use inside a Route Handler.
 * Returns either the account + client, or a NextResponse with the appropriate
 * status (401/403). Use this at the top of any portal-only API route.
 */
export async function requirePortalActor(): Promise<PortalActorContext | PortalActorError> {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      error: NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data, error: rpcError } = await supabase.rpc("portal_get_my_account_v1");
  if (rpcError) {
    return {
      error: NextResponse.json(
        { ok: false, message: rpcError.message ?? "Unable to load portal account" },
        { status: 500 },
      ),
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as PortalAccountRow | undefined;
  if (!row) {
    return {
      error: NextResponse.json(
        { ok: false, message: "No portal access for this account" },
        { status: 403 },
      ),
    };
  }

  return {
    supabase,
    account: {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      email: row.email,
      fullName: row.full_name,
      role: row.role as "viewer" | "manager",
      active: row.active,
      lastLoginAt: row.last_login_at,
    },
  };
}
