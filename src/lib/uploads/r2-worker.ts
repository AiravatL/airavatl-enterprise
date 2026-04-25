import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface WorkerPresignGetResponse {
  view_url?: string;
  download_url?: string;
  object_key?: string;
  expires_in?: number;
  error?: string;
}

interface WorkerConfig {
  baseUrl: string;
}

let _cachedWorkerUrl: string | null = null;

function fromEnv(): string {
  const keys = [
    "R2_PRESIGN_WORKER_URL",
    "NEXT_PUBLIC_R2_PRESIGN_WORKER_URL",
    "CLOUDFLARE_R2_PRESIGN_WORKER_URL",
    "R2_WORKER_URL",
  ];
  for (const key of keys) {
    const value = (process.env[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

async function fromDatabase(): Promise<string> {
  if (_cachedWorkerUrl) return _cachedWorkerUrl;
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase
      .from("platform_settings" as never)
      .select("setting_value" as never)
      .eq("setting_key" as never, "r2_presign_worker_url")
      .maybeSingle();
    const row = data as { setting_value?: { url?: string } } | null;
    const url = row?.setting_value?.url ?? "";
    if (url) _cachedWorkerUrl = url;
    return url;
  } catch {
    return "";
  }
}

export async function getR2WorkerConfig(): Promise<WorkerConfig | null> {
  const envUrl = fromEnv();
  if (envUrl) return { baseUrl: envUrl.replace(/\/$/, "") };
  const dbUrl = await fromDatabase();
  if (dbUrl) return { baseUrl: dbUrl.replace(/\/$/, "") };
  return null;
}

export function buildR2WorkerHeaders(accessToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}
