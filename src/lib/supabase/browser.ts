"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

let cached: SupabaseClient<Database> | null = null;

/**
 * Browser-side Supabase client.
 *
 * Used only to subscribe to Postgres `reservations` changes in real time
 * on the checkout page. All mutations go through the server API
 * (`/api/reservations/*`) so there's no need for the anon key to have
 * RLS write privileges; read-only realtime is sufficient.
 *
 * Returns `null` on the server or when env vars are missing — callers
 * should treat real-time as a progressive enhancement and continue to
 * poll as a fallback.
 */
export function getSupabaseBrowser(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") return null;
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  cached = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}
