import type { PostgrestError } from "@supabase/supabase-js";

export function isMissingRpcError(error: PostgrestError | null | undefined): boolean {
  return error?.code === "PGRST202";
}
