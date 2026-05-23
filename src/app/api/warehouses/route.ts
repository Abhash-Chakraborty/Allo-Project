import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-error";
import { listWarehouses } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const warehouses = await listWarehouses();
    return NextResponse.json(
      { warehouses },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
