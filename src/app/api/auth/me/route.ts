import { NextResponse } from "next/server";

import { requirePortalActor } from "@/lib/auth/server-actor";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requirePortalActor();
  if ("error" in result) return result.error;

  return NextResponse.json({ ok: true, data: result.account });
}
