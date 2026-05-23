import { NextResponse, type NextRequest } from "next/server";

import { errorResponse } from "@/lib/api-error";
import { getReservation } from "@/lib/data";
import { uuidSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/reservations/:id
 *
 * Returns the current reservation. As a side-effect, if this reservation
 * is `pending` but expired, runs `expire_reservations()` so the read sees
 * a fresh `expired` status. This is the lazy-cleanup safety net.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/reservations/[id]">,
) {
  try {
    const { id } = await ctx.params;
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) {
      return errorResponse(parsed.error);
    }
    const reservation = await getReservation(parsed.data);
    return NextResponse.json(
      { reservation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
