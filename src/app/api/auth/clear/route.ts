import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Signs the caller out and redirects to /login. Server Components cannot
 * clear cookies, so the (app) layout uses this when it detects a stale or
 * revoked portal session.
 */
export async function GET(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut().catch(() => {
    // If the session was already invalid, signOut can fail — proceed.
  });

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  // Preserve the reason for telemetry/UX without echoing it as user-facing copy.
  return NextResponse.redirect(url);
}
