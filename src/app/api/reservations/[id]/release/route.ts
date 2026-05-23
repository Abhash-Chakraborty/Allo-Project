import { NextResponse, type NextRequest } from "next/server";

import {
  ApiError,
  apiErrorFromPgError,
  errorResponse,
} from "@/lib/api-error";
import { toReservationDTO } from "@/lib/data";
import { uuidSchema } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ReservationRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/reservations/:id/release
 *
 * Releases a pending reservation early (user cancelled / payment failed).
 * Idempotent at the database level: re-releasing a released or expired
 * reservation returns the row unchanged. We don't bother with the
 * Idempotency-Key dance here.
 *
 * Responses:
 *   200 { reservation }
 *   404 { error: 'not_found' }
 *   409 { error: 'reservation_already_confirmed' }
 */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/reservations/[id]/release">,
) {
  try {
    const { id } = await ctx.params;
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) return errorResponse(parsed.error);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .rpc("release_reservation", { p_id: parsed.data })
      .single<ReservationRow>();

    if (error) throw apiErrorFromPgError(error);
    if (!data) {
      throw new ApiError({
        status: 500,
        code: "internal_error",
        message: "Release RPC returned no row.",
      });
    }

    return NextResponse.json(
      { reservation: toReservationDTO(data) },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
