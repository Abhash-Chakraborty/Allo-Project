import { NextResponse, type NextRequest } from "next/server";

import { errorResponse, apiErrorFromPgError } from "@/lib/api-error";
import { cronSecret } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Manual reservation-expiry endpoint.
 *
 *   Invocation: GET|POST /api/cron/expire-reservations
 *   Auth:       Authorization: Bearer ${CRON_SECRET}
 *
 * Primary expiry runs *inside Postgres* via Supabase `pg_cron`
 * (see `supabase/migrations/0004_cron.sql`) every minute, which is the
 * only viable schedule on Vercel's free tier (limited to one cron / day).
 *
 * This HTTP route stays as a manual escape hatch — useful for one-off
 * sweeps from a terminal (`curl -H "Authorization: Bearer $CRON_SECRET" …`)
 * or for any external scheduler that wants to nudge expiry without
 * waiting for the next pg_cron tick. It calls the same
 * `expire_reservations()` Postgres function.
 */
async function handle(request: NextRequest) {
  if (!cronSecret) {
    return NextResponse.json(
      {
        error: {
          code: "cron_misconfigured",
          message: "CRON_SECRET is not set on the server.",
        },
      },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        error: { code: "unauthorized", message: "Bad CRON token." },
      },
      { status: 401 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("expire_reservations");
    if (error) throw apiErrorFromPgError(error);
    const expired = typeof data === "number" ? data : 0;

    const now = new Date();
    return NextResponse.json(
      {
        expired,
        // Machine-readable UTC for clients/log-shippers, plus IST for humans.
        ran_at: now.toISOString(),
        ran_at_ist: `${new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)} IST`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

// Vercel Cron uses GET; manual invocation can use either.
export const GET = handle;
export const POST = handle;
