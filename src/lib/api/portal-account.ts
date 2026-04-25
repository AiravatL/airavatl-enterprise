import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface PortalAccount {
  id: string;
  customerId: string;
  customerName: string;
  email: string;
  fullName: string;
  role: "viewer" | "manager";
  active: boolean;
  lastLoginAt: string | null;
}

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

/**
 * Returns the current portal user's account + linked customer info,
 * or `null` if the caller is not signed in or has no portal account.
 */
export async function getCurrentPortalAccount(): Promise<PortalAccount | null> {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("portal_get_my_account_v1");
  if (error || !data) return null;

  const row = (Array.isArray(data) ? data[0] : data) as PortalAccountRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    email: row.email,
    fullName: row.full_name,
    role: row.role as "viewer" | "manager",
    active: row.active,
    lastLoginAt: row.last_login_at,
  };
}
