import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — ignore.
            // The middleware refreshes the session.
          }
        },
      },
    },
  );

  // Route .rpc() through the erp schema; .from(), .auth, .storage stay on public.
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "rpc") {
        return (...args: Parameters<typeof target.rpc>) =>
          target.schema("erp").rpc(...args);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
