import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

let cached: SupabaseClient<Database> | null = null;

/**
 * Server-side admin Supabase client.
 *
 * Uses the service-role key, so it MUST NEVER be imported into client
 * components. Marked with `server-only` to enforce that at build time.
 *
 * The `auth` settings disable session persistence and refresh because
 * the server has no browser to store cookies in and we don't use
 * Supabase Auth at all (single-tenant demo).
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    db: { schema: "public" },
    global: {
      headers: { "x-client-info": "allo-server" },
    },
  });

  return cached;
}
