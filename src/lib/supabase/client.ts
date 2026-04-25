import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;
  const raw = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Mirror the server client: route .rpc() through the erp schema while
  // leaving .from(), .auth, .storage etc. on the default public schema.
  client = new Proxy(raw, {
    get(target, prop, receiver) {
      if (prop === "rpc") {
        return (...args: Parameters<typeof target.rpc>) =>
          target.schema("erp").rpc(...args);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return client;
}
