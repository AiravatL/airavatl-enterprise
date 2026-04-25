import { apiRequest } from "@/lib/api/http";
import type { PortalAccount } from "@/lib/api/portal-account";

/**
 * Fetches the current portal account from /api/auth/me. Used by the Zustand
 * auth store after a successful client-side sign-in to verify portal access
 * and load profile data.
 */
export async function getCurrentAccount(): Promise<PortalAccount> {
  return apiRequest<PortalAccount>("/api/auth/me", {
    method: "GET",
    cache: "no-store",
  });
}
