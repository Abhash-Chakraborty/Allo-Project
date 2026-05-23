import { NextResponse, type NextRequest } from "next/server";

import {
  ApiError,
  apiErrorFromPgError,
  errorResponse,
} from "@/lib/api-error";
import { reservationTtlSeconds } from "@/lib/env";
import { withIdempotency } from "@/lib/idempotency";
import { reserveBodySchema } from "@/lib/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { toReservationDTO } from "@/lib/data";
import type { ReservationRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // node:crypto in idempotency.ts

/**
 * POST /api/reservations
 *
 * Body:
 *   { product_id, warehouse_id, quantity, customer_ref? }
 *
 * Optional headers:
 *   Idempotency-Key — when present, repeated requests with the same key
 *                     return the original response without re-running.
 *
 * Responses:
 *   201 { reservation }            — created
 *   400 { error }                  — validation / invalid body
 *   404 { error: 'not_found' }     — no inventory row for (product, warehouse)
 *   409 { error: 'insufficient_stock' } — not enough available units
 *   409 { error: 'idempotency_conflict' } — same key used with different body
 *   425 { error: 'idempotency_in_progress' } — another retry is mid-flight
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = reserveBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse(parsed.error);
    }

    const idempotencyKey = request.headers.get("idempotency-key");

    const handler = async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .rpc("reserve_units", {
          p_product_id: parsed.data.product_id,
          p_warehouse_id: parsed.data.warehouse_id,
          p_quantity: parsed.data.quantity,
          p_ttl_seconds: parsed.data.ttl_seconds ?? reservationTtlSeconds,
          p_customer_ref: parsed.data.customer_ref ?? null,
        })
        .single<ReservationRow>();

      if (error) throw apiErrorFromPgError(error);
      if (!data) {
        throw new ApiError({
          status: 500,
          code: "internal_error",
          message: "Reserve RPC returned no row.",
        });
      }

      return {
        status: 201,
        body: { reservation: toReservationDTO(data) },
      };
    };

    if (idempotencyKey) {
      const result = await withIdempotency(
        idempotencyKey,
        "POST /api/reservations",
        parsed.data,
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
