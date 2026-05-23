import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-error";
import { listProducts } from "@/lib/data";

// Always read-fresh: stock changes second-to-second.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const products = await listProducts();
    return NextResponse.json(
      { products },
      // Cheap defense in depth — explicitly tell every layer not to cache.
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
