import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

// Create per request: never share a server-side session client between users.
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase public configuration is missing.");
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Proxy refreshes them first.
        }
      },
    },
  });
}
