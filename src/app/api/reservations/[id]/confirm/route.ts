import { NextResponse, type NextRequest } from "next/server";

import {
  ApiError,
  apiErrorFromPgError,
  errorResponse,
} from "@/lib/api-error";
import { toReservationDTO } from "@/lib/data";
import { withIdempotency } from "@/lib/idempotency";
import { uuidSchema } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ReservationRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/reservations/:id/confirm
 *
 * Optional `Idempotency-Key` header — same semantics as reserve.
 *
 * Responses:
 *   200 { reservation } — confirmed (or already-confirmed; idempotent)
 *   404 { error: 'not_found' }
 *   409 { error: 'reservation_released' | 'reservation_already_confirmed' }
 *   410 { error: 'reservation_expired' }
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/reservations/[id]/confirm">,
) {
  try {
    const { id } = await ctx.params;
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) return errorResponse(parsed.error);

    const idempotencyKey = request.headers.get("idempotency-key");

    const handler = async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .rpc("confirm_reservation", { p_id: parsed.data })
        .single<ReservationRow>();

      if (error) throw apiErrorFromPgError(error);
      if (!data) {
        throw new ApiError({
          status: 500,
          code: "internal_error",
          message: "Confirm RPC returned no row.",
        });
      }

      return { status: 200, body: { reservation: toReservationDTO(data) } };
    };

    if (idempotencyKey) {
      const result = await withIdempotency(
        idempotencyKey,
        `POST /api/reservations/${parsed.data}/confirm`,
        { id: parsed.data },
        handler,
      );
      const res = NextResponse.json(result.body, {
        status: result.status,
        headers: { "Cache-Control": "no-store" },
      });
      if (result.replayed) res.headers.set("Idempotent-Replay", "true");
      return res;
    }

    const result = await handler();
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
