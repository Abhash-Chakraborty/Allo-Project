import { NextResponse, type NextRequest } from "next/server";

import { errorResponse, apiErrorFromPgError } from "@/lib/api-error";
import { cronSecret } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vercel Cron entrypoint.
 *
 *   Invocation: GET /api/cron/expire-reservations
 *   Schedule:   every minute (see vercel.json)
 *
 * Vercel sends the request with `Authorization: Bearer ${CRON_SECRET}`,
 * which we verify before doing any work — this prevents random visitors
 * from triggering bulk inventory rewrites.
 *
 * On every tick we call the `expire_reservations()` Postgres function
 * which returns the number of reservations transitioned to `expired`.
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

    return NextResponse.json(
      { expired, ran_at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

// Vercel Cron uses GET; manual invocation can use either.
export const GET = handle;
export const POST = handle;
